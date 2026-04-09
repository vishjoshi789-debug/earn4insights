import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import { createMention } from '@/db/repositories/socialMentionRepository'
import { getAllActiveRules, textMatchesRule } from '@/db/repositories/socialListeningRuleRepository'
import { emit, PLATFORM_EVENTS } from '@/server/eventBus'
import { db } from '@/db'
import { products } from '@/db/schema'
import { eq } from 'drizzle-orm'

/**
 * POST /api/webhooks/social-mention
 *
 * Receives social mention payloads from Brand24 / Mention.com / custom webhooks.
 * Verifies HMAC signature using SOCIAL_MENTION_WEBHOOK_SECRET.
 * Stores mention → matches to listening rules → emits social.mention.detected.
 *
 * Expected body:
 * {
 *   platform:    'twitter' | 'instagram' | 'youtube' | 'reddit' | ...
 *   mentionUrl?: string
 *   mentionText: string
 *   authorHandle?: string
 *   authorFollowerCount?: number
 *   sentimentScore?: number   // -1 to 1, or 0–1 decimal
 *   relevanceScore?: number   // 0–1 decimal
 *   detectedAt?:  ISO string
 * }
 *
 * Signature header: x-webhook-signature: sha256=<hmac-hex>
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text()

  // ── Verify HMAC signature ────────────────────────────────────────────────
  const secret = process.env.SOCIAL_MENTION_WEBHOOK_SECRET
  if (secret) {
    const signatureHeader = request.headers.get('x-webhook-signature') ?? ''
    const [algo, receivedHex] = signatureHeader.split('=')

    if (algo !== 'sha256' || !receivedHex) {
      return NextResponse.json({ error: 'Invalid signature format' }, { status: 401 })
    }

    const expectedHmac = createHmac('sha256', secret).update(rawBody).digest('hex')
    const expected = Buffer.from(expectedHmac, 'hex')
    const received = Buffer.from(receivedHex, 'hex')

    // Constant-time comparison prevents timing attacks
    if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }
  }

  let body: Record<string, unknown>
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const {
    platform,
    mentionUrl,
    mentionText,
    authorHandle,
    authorFollowerCount,
    sentimentScore,
    relevanceScore,
    detectedAt,
  } = body as {
    platform?: string
    mentionUrl?: string
    mentionText?: string
    authorHandle?: string
    authorFollowerCount?: number
    sentimentScore?: number
    relevanceScore?: number
    detectedAt?: string
  }

  if (!platform || !mentionText) {
    return NextResponse.json({ error: 'platform and mentionText are required' }, { status: 400 })
  }

  // ── Match mention against active listening rules ──────────────────────────
  const activeRules = await getAllActiveRules()
  const matchedRules = activeRules.filter(rule => textMatchesRule(mentionText, rule))

  if (matchedRules.length === 0) {
    // No rules matched — store as unmatched mention for manual review
    await createMention({
      platform,
      mentionUrl:          mentionUrl ?? null,
      mentionText,
      mentionedEntityType: 'unmatched',
      mentionedEntityId:   'none',
      authorHandle:        authorHandle ?? null,
      authorFollowerCount: authorFollowerCount ?? null,
      sentimentScore:      sentimentScore != null ? String(sentimentScore) : null,
      relevanceScore:      relevanceScore != null ? String(relevanceScore) : null,
      detectedAt:          detectedAt ? new Date(detectedAt) : new Date(),
      processedAt:         new Date(),
    })
    return NextResponse.json({ received: true, matched: 0 })
  }

  // ── Store + emit for each matched rule ────────────────────────────────────
  let notified = 0

  for (const rule of matchedRules) {
    const mention = await createMention({
      platform,
      mentionUrl:          mentionUrl ?? null,
      mentionText,
      mentionedEntityType: rule.entityType,
      mentionedEntityId:   rule.entityId,
      authorHandle:        authorHandle ?? null,
      authorFollowerCount: authorFollowerCount ?? null,
      sentimentScore:      sentimentScore != null ? String(sentimentScore) : null,
      relevanceScore:      relevanceScore != null ? String(relevanceScore) : null,
      detectedAt:          detectedAt ? new Date(detectedAt) : new Date(),
      processedAt:         null,
    })

    // Resolve brand owner for the entity
    let brandId: string | undefined

    if (rule.entityType === 'product') {
      const rows = await db
        .select({ ownerId: products.ownerId })
        .from(products)
        .where(eq(products.id, rule.entityId))
        .limit(1)
      brandId = rows[0]?.ownerId ?? undefined
    } else if (rule.entityType === 'brand') {
      brandId = rule.entityId
    }

    if (brandId) {
      // Fire-and-forget — don't block the webhook response
      emit(PLATFORM_EVENTS.SOCIAL_MENTION_DETECTED, {
        brandId,
        mentionId:   mention.id,
        mentionText: mentionText.slice(0, 200),
        platform,
        entityType:  rule.entityType,
        entityId:    rule.entityId,
      }).catch(err => console.error('[social-mention webhook] emit error:', err))

      notified++
    }
  }

  return NextResponse.json({ received: true, matched: matchedRules.length, notified })
}
