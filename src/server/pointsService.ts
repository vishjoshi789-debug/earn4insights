import { db } from '@/db'
import { userPoints, pointTransactions, userChallengeProgress, challenges } from '@/db/schema'
import { eq, and, sql } from 'drizzle-orm'

// Point values for different actions
export const POINT_VALUES = {
  feedback_submit: 25,
  survey_complete: 50,
  community_post: 10,
  community_reply: 5,
  community_upvote_received: 2,
} as const

// Conversion: 100 points = $1 USD
export const POINTS_PER_DOLLAR = 100

/**
 * Award points to a user and log the transaction.
 * Also checks and advances challenge progress.
 */
export async function awardPoints(
  userId: string,
  amount: number,
  source: string,
  sourceId?: string,
  description?: string,
) {
  // Upsert user_points
  await db
    .insert(userPoints)
    .values({ userId, totalPoints: amount, lifetimePoints: amount })
    .onConflictDoUpdate({
      target: userPoints.userId,
      set: {
        totalPoints: sql`${userPoints.totalPoints} + ${amount}`,
        lifetimePoints: sql`${userPoints.lifetimePoints} + ${amount}`,
        updatedAt: sql`now()`,
      },
    })

  // Log transaction
  await db.insert(pointTransactions).values({
    userId,
    amount,
    type: 'earn',
    source,
    sourceId,
    description,
  })

  // Check challenge progress for this source type
  await advanceChallenges(userId, source)
}

/**
 * Deduct points from a user (for redemptions/payouts).
 * Returns false if insufficient balance.
 */
export async function deductPoints(
  userId: string,
  amount: number,
  source: string,
  sourceId?: string,
  description?: string,
): Promise<boolean> {
  const balance = await getUserBalance(userId)
  if (balance < amount) return false

  await db
    .update(userPoints)
    .set({
      totalPoints: sql`${userPoints.totalPoints} - ${amount}`,
      updatedAt: sql`now()`,
    })
    .where(eq(userPoints.userId, userId))

  await db.insert(pointTransactions).values({
    userId,
    amount: -amount,
    type: 'spend',
    source,
    sourceId,
    description,
  })

  return true
}

/**
 * Get user's current point balance.
 */
export async function getUserBalance(userId: string): Promise<number> {
  const result = await db
    .select({ totalPoints: userPoints.totalPoints })
    .from(userPoints)
    .where(eq(userPoints.userId, userId))
    .limit(1)

  return result[0]?.totalPoints ?? 0
}

/**
 * Advance challenge progress when a qualifying action occurs.
 */
async function advanceChallenges(userId: string, source: string) {
  // Map source to challenge source_type
  const sourceTypeMap: Record<string, string> = {
    feedback_submit: 'feedback',
    survey_complete: 'survey',
    community_post: 'community_post',
    community_reply: 'community_reply',
  }
  const challengeSource = sourceTypeMap[source]
  if (!challengeSource) return

  // Find active challenges for this source type
  const activeChallenges = await db
    .select()
    .from(challenges)
    .where(and(eq(challenges.sourceType, challengeSource), eq(challenges.isActive, true)))

  for (const challenge of activeChallenges) {
    // Upsert progress
    const existing = await db
      .select()
      .from(userChallengeProgress)
      .where(
        and(
          eq(userChallengeProgress.userId, userId),
          eq(userChallengeProgress.challengeId, challenge.id),
        ),
      )
      .limit(1)

    if (existing.length === 0) {
      // First time — create progress
      const completed = 1 >= challenge.targetCount
      await db.insert(userChallengeProgress).values({
        userId,
        challengeId: challenge.id,
        currentCount: 1,
        completed,
        completedAt: completed ? new Date() : null,
      })
      if (completed) {
        // Award challenge bonus (don't recurse — use direct insert)
        await directAwardPoints(userId, challenge.pointsReward, 'challenge_complete', challenge.id, `Completed: ${challenge.title}`)
      }
    } else if (!existing[0].completed) {
      const newCount = existing[0].currentCount + 1
      const completed = newCount >= challenge.targetCount
      await db
        .update(userChallengeProgress)
        .set({
          currentCount: newCount,
          completed,
          completedAt: completed ? new Date() : null,
        })
        .where(eq(userChallengeProgress.id, existing[0].id))

      if (completed) {
        await directAwardPoints(userId, challenge.pointsReward, 'challenge_complete', challenge.id, `Completed: ${challenge.title}`)
      }
    }
  }
}

/**
 * Direct point award without challenge check (to avoid recursion).
 */
async function directAwardPoints(
  userId: string,
  amount: number,
  source: string,
  sourceId?: string,
  description?: string,
) {
  await db
    .insert(userPoints)
    .values({ userId, totalPoints: amount, lifetimePoints: amount })
    .onConflictDoUpdate({
      target: userPoints.userId,
      set: {
        totalPoints: sql`${userPoints.totalPoints} + ${amount}`,
        lifetimePoints: sql`${userPoints.lifetimePoints} + ${amount}`,
        updatedAt: sql`now()`,
      },
    })

  await db.insert(pointTransactions).values({
    userId,
    amount,
    type: 'earn',
    source,
    sourceId,
    description,
  })
}
