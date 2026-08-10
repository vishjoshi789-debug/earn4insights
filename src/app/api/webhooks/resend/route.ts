import { NextRequest, NextResponse } from 'next/server'
import crypto from 'node:crypto'
import {
  applyDeliveryEvent,
  suppressEmail,
  type DeliveryStatus,
} from '@/db/repositories/emailDeliveryRepository'

/**
 * POST /api/webhooks/resend
 *
 * Turns `notification_queue.status='sent'` from a lie into a fact.
 *
 * Before this route, "sent" meant Resend accepted the API call. A suppressed
 * or bouncing recipient returns HTTP 200 and is dropped silently, so
 * production read "23 sent, 0 failed" while potentially delivering nothing.
 * Because email verification is a HARD BLOCK on feedback submission (EV.1),
 * a consumer whose verification mail never lands can never perform the core
 * action — and appears to us as merely inactive.
 *
 * Reachability: `/api/webhooks/` is already in `PUBLIC_PREFIXES` (no session)
 * and `CSRF_EXEMPT_PREFIXES` in `src/middleware.ts`. No middleware change was
 * needed — but that also means THIS ROUTE IS THE ONLY THING AUTHENTICATING
 * ITSELF. The signature check below is not optional hardening; it is the
 * entire access control.
 *
 * Setup (Resend dashboard → Webhooks):
 *   endpoint  https://www.earn4insights.com/api/webhooks/resend
 *   events    email.delivered, email.bounced, email.complained,
 *             email.delivery_delayed  (email.sent optional — we already
 *             record 'accepted' at send time)
 *   then copy the signing secret into RESEND_WEBHOOK_SECRET (whsec_…)
 */

// Node runtime: this route uses node:crypto, which the Edge bundle can't take.
export const runtime = 'nodejs'

/** Resend event type → our delivery status. Unlisted events are ignored. */
const EVENT_STATUS: Record<string, DeliveryStatus> = {
  'email.sent': 'accepted',
  'email.delivered': 'delivered',
  'email.bounced': 'bounced',
  'email.complained': 'complained',
  'email.delivery_delayed': 'delayed',
}

/**
 * Verify the Svix signature Resend signs webhooks with.
 *
 * Implemented directly rather than pulling in the `svix` package: it is ~15
 * lines, and a dependency in the request path of an unauthenticated public
 * endpoint is a supply-chain surface we don't need.
 *
 * Signed content is `${id}.${timestamp}.${rawBody}`, HMAC-SHA256 with the
 * base64 secret body (after the `whsec_` prefix). The header may carry
 * several space-separated `v1,<sig>` values during secret rotation, so we
 * accept a match against ANY of them.
 */
function verifySvixSignature(params: {
  secret: string
  svixId: string
  svixTimestamp: string
  svixSignature: string
  rawBody: string
}): boolean {
  const { secret, svixId, svixTimestamp, svixSignature, rawBody } = params

  // Replay window. Svix recommends 5 minutes; without this a captured
  // request stays valid forever.
  const ts = Number(svixTimestamp)
  if (!Number.isFinite(ts)) return false
  const ageSeconds = Math.abs(Date.now() / 1000 - ts)
  if (ageSeconds > 300) {
    console.warn(`[ResendWebhook] Rejected: timestamp ${ageSeconds.toFixed(0)}s outside window`)
    return false
  }

  const secretBytes = Buffer.from(secret.replace(/^whsec_/, ''), 'base64')
  const expected = crypto
    .createHmac('sha256', secretBytes)
    .update(`${svixId}.${svixTimestamp}.${rawBody}`)
    .digest('base64')

  const expectedBuf = Buffer.from(expected)

  // Constant-time compare against each offered signature.
  return svixSignature.split(' ').some((part) => {
    const sig = part.startsWith('v1,') ? part.slice(3) : null
    if (!sig) return false
    const sigBuf = Buffer.from(sig)
    if (sigBuf.length !== expectedBuf.length) return false
    return crypto.timingSafeEqual(sigBuf, expectedBuf)
  })
}

export async function POST(request: NextRequest) {
  // Raw body is required — the signature covers the exact bytes, so it must
  // be read before any JSON parsing.
  const rawBody = await request.text()

  const secret = process.env.RESEND_WEBHOOK_SECRET
  if (!secret) {
    // FAIL CLOSED. An unsigned public endpoint that writes suppression rows
    // would let anyone mark any address as bounced and cut off their email.
    console.error('[ResendWebhook] RESEND_WEBHOOK_SECRET not set — rejecting')
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 })
  }

  const svixId = request.headers.get('svix-id')
  const svixTimestamp = request.headers.get('svix-timestamp')
  const svixSignature = request.headers.get('svix-signature')

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: 'Missing signature headers' }, { status: 400 })
  }

  if (!verifySvixSignature({ secret, svixId, svixTimestamp, svixSignature, rawBody })) {
    console.warn('[ResendWebhook] Invalid signature — rejected')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let event: { type?: string; data?: Record<string, unknown> }
  try {
    event = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const eventType = event.type ?? ''
  const status = EVENT_STATUS[eventType]

  // Unknown/uninteresting event (email.opened, email.clicked, future types).
  // 200 so Resend doesn't retry something we deliberately ignore.
  if (!status) {
    return NextResponse.json({ ok: true, ignored: eventType })
  }

  const data = event.data ?? {}
  const messageId = typeof data.email_id === 'string' ? data.email_id : null

  // `to` is an array in Resend's payload; our sends are always single-
  // recipient, so the first entry is the address.
  const toRaw = data.to
  const toEmail = Array.isArray(toRaw)
    ? (typeof toRaw[0] === 'string' ? toRaw[0] : null)
    : (typeof toRaw === 'string' ? toRaw : null)

  const detail = buildDetail(data)

  if (messageId) {
    await applyDeliveryEvent({ providerMessageId: messageId, status, detail })
  } else {
    console.warn(`[ResendWebhook] ${eventType} with no email_id — cannot correlate`)
  }

  // ── The behavioural half ────────────────────────────────────────────────
  // Recording a bounce and then continuing to send to it is pointless: each
  // further attempt degrades the sending domain's reputation for every other
  // user. Suppression is what stops one bad address becoming platform-wide
  // delivery failure.
  //
  // NOTE both hard and soft bounces suppress. Resend does not always
  // distinguish them reliably in the payload, and over-suppressing is
  // recoverable (unsuppressEmail) while under-suppressing silently burns
  // domain reputation. Deliberate asymmetry.
  if (toEmail && (status === 'bounced' || status === 'complained')) {
    await suppressEmail({
      email: toEmail,
      reason: status,
      detail: detail ?? eventType,
    })
  }

  return NextResponse.json({ ok: true, type: eventType, status })
}

/** Pull whatever human-readable reason the payload carries. */
function buildDetail(data: Record<string, unknown>): string | null {
  const bounce = data.bounce as Record<string, unknown> | undefined
  if (bounce) {
    const parts = [bounce.type, bounce.subType, bounce.message].filter(
      (v): v is string => typeof v === 'string' && v.length > 0
    )
    if (parts.length > 0) return parts.join(' / ').slice(0, 500)
  }
  if (typeof data.reason === 'string') return data.reason.slice(0, 500)
  return null
}
