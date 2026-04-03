/**
 * Update Consumer Signals — Daily Cron Job
 *
 * Collects and persists signal snapshots for all active users, then purges
 * snapshots older than SIGNAL_RETENTION_DAYS.
 *
 * Called by: GET /api/cron/update-consumer-signals (Vercel Cron, daily at 02:30 UTC)
 *
 * Per-user logic:
 *   1. Run collectAndPersistSignals(userId, 'cron_daily')
 *      - Each signal category (behavioral/demographic/psychographic/social) is
 *        independently consent-gated — unconsented categories are silently skipped.
 *   2. Mark ICP match scores stale so recomputeIcpScores picks them up next.
 *
 * After all users:
 *   3. Delete signal snapshots older than SIGNAL_RETENTION_DAYS.
 *
 * Design decisions:
 *   - Users are processed sequentially (not Promise.all) to avoid DB overload.
 *   - A single user failure does not abort the batch.
 *   - Batch size is configurable via SIGNAL_CRON_BATCH_SIZE env var (default: all).
 */

import 'server-only'

import { db } from '@/db'
import { userProfiles } from '@/db/schema'
import { collectAndPersistSignals } from '@/server/signalCollectionService'
import { deleteExpiredSnapshots } from '@/db/repositories/signalRepository'
import { markScoresStaleByConsumer } from '@/db/repositories/icpRepository'

export type SignalCronResult = {
  startedAt: string
  completedAt: string
  usersProcessed: number
  usersErrored: number
  snapshotsExpiredDeleted: number
  details: Array<{
    userId: string
    categories: Record<string, string>
    error?: string
  }>
}

/**
 * Run the daily signal collection for all users.
 * Returns a structured result log for the cron route to return as JSON.
 */
export async function runUpdateConsumerSignals(): Promise<SignalCronResult> {
  const startedAt = new Date().toISOString()

  // Load all user IDs (only id column — minimal memory footprint)
  const users = await db.select({ id: userProfiles.id }).from(userProfiles)

  const batchSizeEnv = process.env.SIGNAL_CRON_BATCH_SIZE
  const batchSize = batchSizeEnv ? parseInt(batchSizeEnv) : users.length
  const batch = users.slice(0, batchSize)

  let usersProcessed = 0
  let usersErrored = 0
  const details: SignalCronResult['details'] = []

  for (const { id: userId } of batch) {
    try {
      const summary = await collectAndPersistSignals(userId, 'cron_daily')

      // Mark ICP scores stale — signals changed, scores need recompute
      await markScoresStaleByConsumer(userId).catch((err) =>
        console.error(`[SignalCron] Failed to mark scores stale for ${userId}:`, err)
      )

      usersProcessed++
      details.push({ userId, categories: summary.categories })
    } catch (err) {
      usersErrored++
      details.push({
        userId,
        categories: {},
        error: err instanceof Error ? err.message : String(err),
      })
      console.error(`[SignalCron] Error processing user ${userId}:`, err)
    }
  }

  // Purge expired snapshots (rolling retention window)
  const snapshotsExpiredDeleted = await deleteExpiredSnapshots().catch((err) => {
    console.error('[SignalCron] Failed to delete expired snapshots:', err)
    return 0
  })

  const completedAt = new Date().toISOString()

  console.log(
    `[SignalCron] Done. processed=${usersProcessed} errored=${usersErrored} ` +
      `expiredDeleted=${snapshotsExpiredDeleted}`
  )

  return {
    startedAt,
    completedAt,
    usersProcessed,
    usersErrored,
    snapshotsExpiredDeleted,
    details,
  }
}
