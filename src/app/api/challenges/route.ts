import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { db } from '@/db'
import { challenges, userChallengeProgress } from '@/db/schema'
import { eq } from 'drizzle-orm'

// GET /api/challenges — list challenges with user progress
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const activeChallenges = await db
      .select()
      .from(challenges)
      .where(eq(challenges.isActive, true))
      .orderBy(challenges.pointsReward)

    // Get user progress for each challenge
    const progress = await db
      .select()
      .from(userChallengeProgress)
      .where(eq(userChallengeProgress.userId, session.user.id))

    const progressMap = new Map(progress.map(p => [p.challengeId, p]))

    const result = activeChallenges.map(c => ({
      ...c,
      currentCount: progressMap.get(c.id)?.currentCount ?? 0,
      completed: progressMap.get(c.id)?.completed ?? false,
      completedAt: progressMap.get(c.id)?.completedAt,
    }))

    return NextResponse.json({ challenges: result })
  } catch (error) {
    console.error('[Challenges GET] Error:', error)
    return NextResponse.json({ error: 'Failed to fetch challenges' }, { status: 500 })
  }
}
