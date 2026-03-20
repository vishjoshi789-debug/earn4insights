import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { db } from '@/db'
import { contributionEvents, userReputation, trustFlags } from '@/db/schema'
import { eq, desc, sql, and, gte } from 'drizzle-orm'
import { getUserReputation } from '@/server/contributionPipeline'

/**
 * GET /api/contribution/intelligence
 *
 * Returns contribution analytics for the current user:
 *   - reputation summary
 *   - recent contributions with AI scores
 *   - trust flags (if any)
 *
 * Query params:
 *   - limit (default 20, max 50)
 *   - page (default 1)
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id
    const params = req.nextUrl.searchParams
    const page = Math.max(1, parseInt(params.get('page') || '1'))
    const limit = Math.min(50, Math.max(1, parseInt(params.get('limit') || '20')))
    const offset = (page - 1) * limit

    // Fetch in parallel
    const [reputation, contributions, flagsResult, statsResult] = await Promise.all([
      getUserReputation(userId),

      db
        .select()
        .from(contributionEvents)
        .where(eq(contributionEvents.userId, userId))
        .orderBy(desc(contributionEvents.createdAt))
        .limit(limit)
        .offset(offset),

      db
        .select()
        .from(trustFlags)
        .where(and(eq(trustFlags.userId, userId), eq(trustFlags.resolved, false)))
        .orderBy(desc(trustFlags.createdAt))
        .limit(10),

      db
        .select({
          totalContributions: sql<number>`count(*)::int`,
          avgQuality: sql<number>`coalesce(avg(${contributionEvents.qualityScore}), 0)::real`,
          totalTokensEarned: sql<number>`coalesce(sum(${contributionEvents.finalTokens}), 0)::int`,
          scoredCount: sql<number>`count(*) filter (where ${contributionEvents.status} = 'scored' or ${contributionEvents.status} = 'rewarded')::int`,
          flaggedCount: sql<number>`count(*) filter (where ${contributionEvents.status} = 'flagged')::int`,
        })
        .from(contributionEvents)
        .where(eq(contributionEvents.userId, userId)),
    ])

    const stats = statsResult[0] || { totalContributions: 0, avgQuality: 0, totalTokensEarned: 0, scoredCount: 0, flaggedCount: 0 }

    return NextResponse.json({
      reputation,
      contributions: contributions.map(c => ({
        id: c.id,
        type: c.contributionType,
        qualityScore: c.qualityScore,
        qualityReasoning: c.qualityReasoning,
        relevanceScore: c.relevanceScore,
        depthScore: c.depthScore,
        clarityScore: c.clarityScore,
        noveltyScore: c.noveltyScore,
        actionabilityScore: c.actionabilityScore,
        authenticityScore: c.authenticityScore,
        basePoints: c.basePoints,
        qualityMultiplier: c.qualityMultiplier,
        brandWeight: c.brandWeight,
        reputationMultiplier: c.reputationMultiplier,
        finalTokens: c.finalTokens,
        status: c.status,
        createdAt: c.createdAt,
        scoredAt: c.scoredAt,
      })),
      stats,
      activeFlags: flagsResult.length,
      pagination: { page, limit },
    })
  } catch (error) {
    console.error('[Contribution Intelligence GET] Error:', error)
    return NextResponse.json({ error: 'Failed to fetch contribution data' }, { status: 500 })
  }
}
