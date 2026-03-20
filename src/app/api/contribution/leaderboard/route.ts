import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { db } from '@/db'
import { userReputation, users } from '@/db/schema'
import { desc, sql } from 'drizzle-orm'

/**
 * GET /api/contribution/leaderboard
 *
 * Returns top contributors ranked by reputation score.
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

    const params = req.nextUrl.searchParams
    const page = Math.max(1, parseInt(params.get('page') || '1'))
    const limit = Math.min(50, Math.max(1, parseInt(params.get('limit') || '20')))
    const offset = (page - 1) * limit

    const leaderboard = await db
      .select({
        userId: userReputation.userId,
        userName: users.name,
        reputationScore: userReputation.reputationScore,
        tier: userReputation.tier,
        totalContributions: userReputation.totalContributions,
        qualityAvg: userReputation.qualityAvg,
        streakDays: userReputation.streakDays,
        earningMultiplier: userReputation.earningMultiplier,
      })
      .from(userReputation)
      .leftJoin(users, sql`${userReputation.userId} = ${users.id}`)
      .orderBy(desc(userReputation.reputationScore))
      .limit(limit)
      .offset(offset)

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(userReputation)

    const total = countResult?.count ?? 0

    return NextResponse.json({
      leaderboard,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error('[Leaderboard GET] Error:', error)
    return NextResponse.json({ error: 'Failed to fetch leaderboard' }, { status: 500 })
  }
}
