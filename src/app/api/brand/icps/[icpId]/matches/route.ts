/**
 * ICP Matches API
 *
 * GET  /api/brand/icps/[icpId]/matches
 *   Returns the top-matching consumers for an ICP (from cached icp_match_scores).
 *   Only returns non-stale scores above the ICP's matchThreshold.
 *
 *   Query params:
 *     minScore  — override ICP threshold (default: icp.matchThreshold)
 *     limit     — max results, capped at 100 (default: 50)
 *
 * POST /api/brand/icps/[icpId]/matches
 *   Trigger a fresh match score computation for a specific consumer.
 *   Body: { consumerId }
 *
 *   Used for on-demand scoring (e.g. when a brand views a consumer's profile).
 *   The score is persisted and replaces any stale cached value.
 *
 * Access: brand role only. Brands can only query their own ICPs.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { getIcpById } from '@/db/repositories/icpRepository'
import {
  getTopMatchesForIcp,
  scoreConsumerForIcp,
} from '@/server/icpMatchScoringService'

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

// ── GET — top matches from cache ──────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ icpId: string }> }
) {
  try {
    const { icpId } = await params
    const authResult = await getBrandAndVerifyOwnership(icpId)
    if (authResult instanceof NextResponse) return authResult

    const icp = await getIcpById(icpId)
    if (!icp) return NextResponse.json({ error: 'ICP not found' }, { status: 404 })

    const { searchParams } = req.nextUrl
    const minScore = searchParams.get('minScore') !== null
      ? Math.max(0, Math.min(100, parseInt(searchParams.get('minScore')!)))
      : icp.matchThreshold
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)

    const matches = await getTopMatchesForIcp(icpId, { minScore, limit })

    return NextResponse.json({
      icpId,
      matchThreshold: icp.matchThreshold,
      minScore,
      matches,
      total: matches.length,
    })
  } catch (error) {
    console.error('[ICP Matches GET] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ── POST — compute fresh score for a consumer ─────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ icpId: string }> }
) {
  try {
    const { icpId } = await params
    const authResult = await getBrandAndVerifyOwnership(icpId)
    if (authResult instanceof NextResponse) return authResult

    const body = await req.json().catch(() => null)
    if (!body?.consumerId || typeof body.consumerId !== 'string') {
      return NextResponse.json(
        { error: 'Missing required field: consumerId' },
        { status: 400 }
      )
    }

    const result = await scoreConsumerForIcp(icpId, body.consumerId, true)

    return NextResponse.json({
      icpId,
      consumerId: result.consumerId,
      matchScore: result.matchScore,
      breakdown: result.breakdown,
      persisted: result.persisted,
    })
  } catch (error) {
    console.error('[ICP Matches POST] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
