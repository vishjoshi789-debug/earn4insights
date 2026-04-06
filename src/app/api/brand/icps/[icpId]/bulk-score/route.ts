/**
 * Bulk ICP Score API
 *
 * POST /api/brand/icps/[icpId]/bulk-score
 *   Score a batch of consumers against an ICP in one call.
 *   Body: { consumerIds: string[] }  — max 200 IDs per request
 *
 *   Scoring is sequential (intentional — avoids concurrent DB/decryption pressure).
 *   At ~100ms per consumer, 200 consumers ≈ 20s — within Vercel's 60s Pro limit.
 *
 *   Rate limited: 2 requests per 60s per IP (in-memory, per-instance).
 *   For stricter global limiting, swap checkRateLimit for Upstash Redis.
 *
 * Access: brand role only. Brands can only score consumers against their own ICPs.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { getIcpById } from '@/db/repositories/icpRepository'
import { batchScoreConsumersForIcp } from '@/server/icpMatchScoringService'
import { checkRateLimit, getRateLimitKey, RATE_LIMITS } from '@/lib/rate-limit'

const MAX_CONSUMER_IDS = 200

// ── Auth + ownership ──────────────────────────────────────────────

async function getBrandAndVerifyOwnership(
  icpId: string
): Promise<{ userId: string } | NextResponse> {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = (session.user as any).id
  const role = (session.user as any).role
  if (!userId || role !== 'brand') {
    return NextResponse.json({ error: 'Brand access only' }, { status: 403 })
  }

  const icp = await getIcpById(icpId)
  if (!icp) {
    return NextResponse.json({ error: 'ICP not found' }, { status: 404 })
  }
  if (icp.brandId !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return { userId }
}

// ── POST — batch score consumers ──────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ icpId: string }> }
) {
  try {
    // Rate limit check
    const rlKey = getRateLimitKey(req, 'bulk-score')
    const rl = checkRateLimit(rlKey, RATE_LIMITS.bulkScore)
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Max 2 bulk-score requests per 60 seconds.' },
        {
          status: 429,
          headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) },
        }
      )
    }

    const { icpId } = await params
    const authResult = await getBrandAndVerifyOwnership(icpId)
    if (authResult instanceof NextResponse) return authResult

    const body = await req.json().catch(() => null)
    if (!body || !Array.isArray(body.consumerIds)) {
      return NextResponse.json(
        { error: 'Missing required field: consumerIds (array)' },
        { status: 400 }
      )
    }

    const { consumerIds } = body as { consumerIds: unknown[] }

    if (consumerIds.length === 0) {
      return NextResponse.json({ error: 'consumerIds must not be empty' }, { status: 400 })
    }

    if (consumerIds.length > MAX_CONSUMER_IDS) {
      return NextResponse.json(
        {
          error: `Too many consumer IDs. Maximum allowed: ${MAX_CONSUMER_IDS}. Received: ${consumerIds.length}.`,
          hint: 'Split your request into batches of 200 or fewer.',
        },
        { status: 400 }
      )
    }

    // Validate all entries are non-empty strings
    const validIds = consumerIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
    if (validIds.length !== consumerIds.length) {
      return NextResponse.json(
        { error: 'All entries in consumerIds must be non-empty strings' },
        { status: 400 }
      )
    }

    const results = await batchScoreConsumersForIcp(icpId, validIds)

    return NextResponse.json({
      icpId,
      requested: validIds.length,
      scored: results.length,
      failed: validIds.length - results.length,
      results: results.map((r) => ({
        consumerId: r.consumerId,
        matchScore: r.matchScore,
        consentGaps: r.breakdown.consentGaps,
      })),
    })
  } catch (error) {
    console.error('[BulkScore POST] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
