import { db } from '@/db'
import { userPoints, pointTransactions, userChallengeProgress, challenges, auditLog } from '@/db/schema'
import { eq, and, gte, sql } from 'drizzle-orm'

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
 *
 * Atomic, transactional, audit-logged. Financial-grade. Returns:
 *   - true  if the deduction succeeded (balance updated, transaction
 *           record written, audit log row written — all in one tx)
 *   - false if the balance was insufficient at the moment of the
 *           UPDATE (audit log row still written, tagged
 *           action='points_deduct_failed')
 *
 * Why the WHERE-guarded UPDATE pattern:
 *   The previous implementation did `SELECT balance` then `UPDATE
 *   total_points = total_points - amount` in two separate statements.
 *   Between the SELECT and the UPDATE there was a TOCTOU window: two
 *   concurrent redemptions could both see balance=600, both deduct
 *   500, and the balance would land at -400. Real risk on the
 *   redemption endpoint where a user could double-click "Redeem"
 *   or fire two requests from two tabs.
 *
 *   The fix is to bake the balance check into the UPDATE itself:
 *     UPDATE user_points
 *        SET total_points = total_points - $amount
 *      WHERE user_id = $uid AND total_points >= $amount
 *
 *   PostgreSQL takes a row-level lock during the UPDATE, so a
 *   concurrent deduct waits, then sees the already-decremented
 *   balance. If it would push negative, the WHERE clause fails
 *   and 0 rows are returned — we surface that as "insufficient".
 *
 *   The two related writes (user_points UPDATE + point_transactions
 *   INSERT + audit_log INSERT) all happen inside one db.transaction()
 *   so either all three commit or all three roll back. Previously
 *   the INSERT happened outside any tx — if it failed after the
 *   UPDATE succeeded, the balance moved but no transaction record
 *   existed (silent integrity break).
 *
 * Audit ref: Pass 2 C3.
 */
export async function deductPoints(
  userId: string,
  amount: number,
  source: string,
  sourceId?: string,
  description?: string,
): Promise<boolean> {
  // Defensive entry guard. A caller passing 0 or negative would
  // bypass the balance check (UPDATE x - 0 always succeeds, UPDATE
  // x - (-5) would ADD points). Should never happen with valid
  // callers — they all validate before calling — but the cost of
  // this check is one branch.
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error(`deductPoints: amount must be a positive integer (got ${amount})`)
  }

  return db.transaction(async (tx) => {
    // ── Atomic UPDATE with inline balance guard ───────────────────
    // RETURNING gives us the new balance; the row count tells us
    // whether the guard passed (1 row) or blocked (0 rows).
    const updated = await tx
      .update(userPoints)
      .set({
        totalPoints: sql`${userPoints.totalPoints} - ${amount}`,
        updatedAt: sql`now()`,
      })
      .where(and(
        eq(userPoints.userId, userId),
        gte(userPoints.totalPoints, amount),
      ))
      .returning({ totalPoints: userPoints.totalPoints })

    if (updated.length === 0) {
      // Insufficient balance (or user_points row doesn't exist).
      // Write an audit_log row so we can investigate complaints
      // ("I had X points and it said insufficient"). Do NOT write
      // to point_transactions — that table is the balance source
      // of truth and should only carry settled movements.
      await tx.insert(auditLog).values({
        userId,
        action: 'points_deduct_failed',
        dataType: 'user_points',
        accessedBy: userId,
        metadata: {
          attemptedAmount: amount,
          source,
          sourceId: sourceId ?? null,
          description: description ?? null,
          reason: 'insufficient_balance_or_no_row',
        },
        reason: 'Points deduction blocked — insufficient balance at UPDATE time',
      })
      return false
    }

    // ── Success — record the spend + audit trail in the same tx ───
    await tx.insert(pointTransactions).values({
      userId,
      amount: -amount,
      type: 'spend',
      source,
      sourceId,
      description,
    })

    await tx.insert(auditLog).values({
      userId,
      action: 'points_deducted',
      dataType: 'user_points',
      accessedBy: userId,
      metadata: {
        amount,
        source,
        sourceId: sourceId ?? null,
        description: description ?? null,
        newBalance: updated[0].totalPoints,
      },
      reason: 'Points deducted successfully',
    })

    return true
  })
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
