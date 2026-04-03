/**
 * ICP Audience Analytics API
 *
 * GET /api/analytics/icp-audience?icpId=<uuid>
 *
 * Returns aggregate analytics for the consumers that match an ICP.
 * Designed for the brand dashboard's "Audience Insights" panel.
 *
 * Access: brand role only. The brand must own the ICP.
 *
 * Response includes:
 *   - Total consumers scored + how many are above threshold
 *   - Score distribution (bucketed: 0-20, 21-40, 41-60, 61-80, 81-100)
 *   - Average match score for qualifying consumers
 *   - Top consent gaps (criteria skipped most often due to missing consent)
 *   - Criteria performance: average earned/max per criterion across matching consumers
 *
 * Privacy:
 *   - No individual consumer IDs or PII in the response
 *   - Aggregates only — minimum bucket size of 5 to prevent re-identification
 *   - Consent gaps are listed by criterion name only (no consumer linkage)
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { getIcpById, getTopMatchesForIcp } from '@/db/repositories/icpRepository'
import { db } from '@/db'
import { icpMatchScores } from '@/db/schema'
import { eq, and } from 'drizzle-orm'

// Minimum cohort size to return aggregates (re-identification guard)
const MIN_COHORT_SIZE = 5

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = (session.user as any).id
    const role = (session.user as any).role
    if (!userId || role !== 'brand') {
      return NextResponse.json({ error: 'Brand access only' }, { status: 403 })
    }

    const icpId = req.nextUrl.searchParams.get('icpId')
    if (!icpId) {
      return NextResponse.json(
        { error: 'Missing required query param: icpId' },
        { status: 400 }
      )
    }

    const icp = await getIcpById(icpId)
    if (!icp) {
      return NextResponse.json({ error: 'ICP not found' }, { status: 404 })
    }
    if (icp.brandId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Load all non-stale match scores for this ICP
    const allScores = await db
      .select()
      .from(icpMatchScores)
      .where(
        and(
          eq(icpMatchScores.icpId, icpId),
          eq(icpMatchScores.isStale, false)
        )
      )

    const totalScored = allScores.length
    const qualifyingScores = allScores.filter((s) => s.matchScore >= icp.matchThreshold)
    const totalQualifying = qualifyingScores.length

    if (totalScored === 0) {
      return NextResponse.json({
        icpId,
        icpName: icp.name,
        matchThreshold: icp.matchThreshold,
        totalScored: 0,
        totalQualifying: 0,
        analytics: null,
        note: 'No match scores computed yet. Run the ICP scoring cron or trigger a manual score.',
      })
    }

    // ── Score distribution (5 buckets) ─────────────────────────
    const buckets = { '0-20': 0, '21-40': 0, '41-60': 0, '61-80': 0, '81-100': 0 }
    for (const s of allScores) {
      if (s.matchScore <= 20) buckets['0-20']++
      else if (s.matchScore <= 40) buckets['21-40']++
      else if (s.matchScore <= 60) buckets['41-60']++
      else if (s.matchScore <= 80) buckets['61-80']++
      else buckets['81-100']++
    }

    // Suppress buckets below MIN_COHORT_SIZE (privacy guard)
    const scoreDistribution = Object.fromEntries(
      Object.entries(buckets).map(([bucket, count]) => [
        bucket,
        count >= MIN_COHORT_SIZE ? count : null,
      ])
    )

    // ── Average score (qualifying only) ────────────────────────
    const avgScore =
      totalQualifying > 0
        ? Math.round(
            qualifyingScores.reduce((sum, s) => sum + s.matchScore, 0) / totalQualifying
          )
        : null

    // ── Consent gap frequency ───────────────────────────────────
    // Count how often each criterion was skipped due to missing consent
    const gapCounts: Record<string, number> = {}
    for (const s of allScores) {
      const breakdown = s.breakdown as any
      for (const gap of breakdown?.consentGaps ?? []) {
        gapCounts[gap] = (gapCounts[gap] || 0) + 1
      }
    }
    // Sort by frequency desc, only include if count >= MIN_COHORT_SIZE
    const topConsentGaps = Object.entries(gapCounts)
      .filter(([, count]) => count >= MIN_COHORT_SIZE)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([criterion, count]) => ({
        criterion,
        affectedConsumers: count,
        percentageOfScored: Math.round((count / totalScored) * 100),
      }))

    // ── Criteria performance (qualifying consumers only) ────────
    // Average earned/max per criterion across qualifying consumers
    const criteriaAccumulators: Record<string, { totalEarned: number; max: number; count: number }> = {}

    for (const s of qualifyingScores) {
      const breakdown = s.breakdown as any
      for (const [criterion, scores] of Object.entries(breakdown?.criteriaScores ?? {})) {
        const cs = scores as { earned: number; max: number }
        if (!criteriaAccumulators[criterion]) {
          criteriaAccumulators[criterion] = { totalEarned: 0, max: cs.max, count: 0 }
        }
        criteriaAccumulators[criterion].totalEarned += cs.earned
        criteriaAccumulators[criterion].count++
      }
    }

    const criteriaPerformance = Object.entries(criteriaAccumulators)
      .filter(([, acc]) => acc.count >= MIN_COHORT_SIZE)
      .map(([criterion, acc]) => ({
        criterion,
        avgEarned: Math.round(acc.totalEarned / acc.count),
        max: acc.max,
        avgMatchRate: Math.round((acc.totalEarned / acc.count / acc.max) * 100),
      }))
      .sort((a, b) => b.avgMatchRate - a.avgMatchRate)

    return NextResponse.json({
      icpId,
      icpName: icp.name,
      matchThreshold: icp.matchThreshold,
      totalScored,
      totalQualifying,
      qualificationRate:
        totalScored > 0 ? Math.round((totalQualifying / totalScored) * 100) : 0,
      analytics: {
        avgScore,
        scoreDistribution,
        topConsentGaps,
        criteriaPerformance,
      },
      privacyNote: `Buckets and criteria with fewer than ${MIN_COHORT_SIZE} consumers are suppressed (null) to prevent re-identification.`,
    })
  } catch (error) {
    console.error('[ICPAudience GET] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
