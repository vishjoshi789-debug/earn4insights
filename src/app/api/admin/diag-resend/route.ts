import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

/**
 * GET /api/admin/diag-resend?to=<email>
 * Header: x-api-key: <ADMIN_API_KEY>
 *
 * Probes Resend end-to-end:
 *   - is RESEND_API_KEY set?
 *   - what FROM address will support emails use?
 *   - does an actual send succeed?
 *
 * Returns the structured result so we don't have to dig through
 * Vercel logs. If you pass ?to=<your-email>, that's the recipient;
 * otherwise it defaults to SUPPORT_ADMIN_EMAIL (the admin inbox).
 *
 * Sample success:
 *   { ok: true, hasKey: true, from: '...', to: '...', resendId: 'em_...' }
 *
 * Sample failure:
 *   { ok: false, hasKey: false, cause: 'api_key',
 *     message: 'RESEND_API_KEY env var not set' }
 *
 *   { ok: false, hasKey: true, cause: 'from_not_verified',
 *     status: 403, message: 'The earn4insights.com domain is not verified.' }
 *
 *   { ok: false, hasKey: true, cause: 'invalid_to',
 *     message: 'Invalid recipient address' }
 */
function classifyResendError(e: unknown): string {
  const msg = (() => {
    if (!e) return ''
    if (typeof e === 'string') return e
    if (typeof e === 'object') {
      const anyE = e as Record<string, unknown>
      return String(anyE.message ?? anyE.error ?? JSON.stringify(anyE))
    }
    return String(e)
  })().toLowerCase()
  if (msg.includes('domain') && msg.includes('not verified')) return 'from_not_verified'
  if (msg.includes('api') && msg.includes('key')) return 'api_key'
  if (msg.includes('invalid') && (msg.includes('to') || msg.includes('recipient'))) return 'invalid_to'
  if (msg.includes('rate') && msg.includes('limit')) return 'rate_limited'
  if (msg.includes('forbidden') || msg.includes('403')) return 'forbidden'
  return 'unknown'
}

export async function GET(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key')
  if (!process.env.ADMIN_API_KEY || apiKey !== process.env.ADMIN_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const fromAddress = process.env.EMAIL_FROM || 'support@earn4insights.com'
  const adminInbox = process.env.SUPPORT_ADMIN_EMAIL || 'contact@earn4insights.com'
  // Strip any whitespace that may have crept in via clipboard / shell escaping.
  // Common when PS users paste the curl one-liner and a non-breaking space lands
  // mid-URL — Resend then rejects the address as malformed.
  const rawTo = request.nextUrl.searchParams.get('to') || adminInbox
  const to = rawTo.replace(/\s+/g, '')
  const hasKey = !!process.env.RESEND_API_KEY

  // Pre-validate the cleaned address before we pay for a Resend round-trip.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return NextResponse.json({
      ok: false,
      hasKey,
      from: fromAddress,
      to,
      rawTo,
      cause: 'invalid_to',
      message: `Recipient "${to}" is not a valid email address (rawTo="${rawTo}"). ` +
               `Check for stray whitespace in the URL.`,
    })
  }

  if (!hasKey) {
    return NextResponse.json({
      ok: false,
      hasKey: false,
      from: fromAddress,
      to,
      cause: 'api_key',
      message: 'RESEND_API_KEY env var not set in Vercel',
    })
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const { data, error } = await resend.emails.send({
      from: fromAddress,
      to,
      subject: `[E4I diag] Resend test ${new Date().toISOString()}`,
      html: `<p>This is a Resend diagnostic test.</p>
             <p>From: <code>${fromAddress}</code></p>
             <p>To: <code>${to}</code></p>
             <p>Time: <code>${new Date().toISOString()}</code></p>
             <p>If you received this, the support email pipeline works.</p>`,
      text: `Resend diagnostic — sent from ${fromAddress} to ${to} at ${new Date().toISOString()}.`,
    })
    if (error) {
      return NextResponse.json({
        ok: false,
        hasKey: true,
        from: fromAddress,
        to,
        cause: classifyResendError(error),
        error,
      })
    }
    return NextResponse.json({
      ok: true,
      hasKey: true,
      from: fromAddress,
      to,
      resendId: data?.id,
      hint:
        'If the email arrived, the pipeline is working. ' +
        'If it didn\'t, check the recipient\'s spam folder, ' +
        'and confirm the FROM domain is verified in Resend → Domains.',
    })
  } catch (err) {
    return NextResponse.json({
      ok: false,
      hasKey: true,
      from: fromAddress,
      to,
      cause: classifyResendError(err),
      message: err instanceof Error ? err.message : String(err),
    })
  }
}
