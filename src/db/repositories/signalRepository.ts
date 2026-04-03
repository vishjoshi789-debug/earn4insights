import 'server-only'

import { db } from '@/db'
import {
  consumerSignalSnapshots,
  userProfiles,
  type ConsumerSignalSnapshot,
  type NewConsumerSignalSnapshot,
} from '@/db/schema'
import { eq, and, gte, lte, desc, lt } from 'drizzle-orm'

// ── Retention config ──────────────────────────────────────────────
// Set SIGNAL_RETENTION_DAYS in environment to override.
// Adjustable without code changes.
export const SIGNAL_RETENTION_DAYS = Number(
  process.env.SIGNAL_RETENTION_DAYS ?? '365'
)

// ── Signal category type ──────────────────────────────────────────
export type SignalCategory =
  | 'behavioral'
  | 'demographic'
  | 'psychographic'
  | 'sensitive'
  | 'social'

export type TriggeredBy =
  | 'cron_daily'
  | 'onboarding_complete'
  | 'feedback_submit'
  | 'social_sync'
  | 'manual'

// ── Writes ────────────────────────────────────────────────────────

/**
 * Insert a new signal snapshot for a user.
 * Never updates an existing row — always inserts.
 * Returns the created snapshot.
 */
export async function insertSignalSnapshot(
  userId: string,
  signalCategory: SignalCategory,
  signals: Record<string, any>,
  triggeredBy: TriggeredBy,
  schemaVersion = '1.0'
): Promise<ConsumerSignalSnapshot> {
  const [row] = await db
    .insert(consumerSignalSnapshots)
    .values({
      userId,
      signalCategory,
      signals,
      triggeredBy,
      schemaVersion,
    } satisfies Omit<NewConsumerSignalSnapshot, 'id' | 'snapshotAt'>)
    .returning()

  return row
}

/**
 * Update userProfiles.lastSignalComputedAt after a successful signal aggregation.
 * Keeps the live profile in sync so callers know when signals were last refreshed.
 */
export async function markSignalsComputed(userId: string): Promise<void> {
  await db
    .update(userProfiles)
    .set({ lastSignalComputedAt: new Date() })
    .where(eq(userProfiles.id, userId))
}

// ── Reads ─────────────────────────────────────────────────────────

/**
 * Get the most recent snapshot for a user + category.
 * Returns null if no snapshot has been recorded yet.
 */
export async function getLatestSignalSnapshot(
  userId: string,
  signalCategory: SignalCategory
): Promise<ConsumerSignalSnapshot | null> {
  const rows = await db
    .select()
    .from(consumerSignalSnapshots)
    .where(
      and(
        eq(consumerSignalSnapshots.userId, userId),
        eq(consumerSignalSnapshots.signalCategory, signalCategory)
      )
    )
    .orderBy(desc(consumerSignalSnapshots.snapshotAt))
    .limit(1)

  return rows[0] ?? null
}

/**
 * Get the latest snapshot for every signal category for a user.
 * Returns a map of signalCategory → snapshot.
 * Categories with no snapshots are absent from the map.
 */
export async function getAllLatestSignals(
  userId: string
): Promise<Partial<Record<SignalCategory, ConsumerSignalSnapshot>>> {
  const categories: SignalCategory[] = [
    'behavioral',
    'demographic',
    'psychographic',
    'sensitive',
    'social',
  ]

  // Fetch all snapshots for user, ordered by time
  const rows = await db
    .select()
    .from(consumerSignalSnapshots)
    .where(eq(consumerSignalSnapshots.userId, userId))
    .orderBy(desc(consumerSignalSnapshots.snapshotAt))

  // Pick the most recent row per category
  const result: Partial<Record<SignalCategory, ConsumerSignalSnapshot>> = {}
  for (const row of rows) {
    const cat = row.signalCategory as SignalCategory
    if (categories.includes(cat) && !result[cat]) {
      result[cat] = row
    }
  }

  return result
}

/**
 * Get the historical snapshots for a user + category within a time range.
 * Used for preference drift visualisation and GDPR Art. 15 data access.
 */
export async function getSignalHistory(
  userId: string,
  signalCategory: SignalCategory,
  options?: {
    limit?: number
    since?: Date
    until?: Date
  }
): Promise<ConsumerSignalSnapshot[]> {
  const limit = options?.limit ?? 100
  const conditions = [
    eq(consumerSignalSnapshots.userId, userId),
    eq(consumerSignalSnapshots.signalCategory, signalCategory),
  ]

  if (options?.since) {
    conditions.push(gte(consumerSignalSnapshots.snapshotAt, options.since))
  }
  if (options?.until) {
    conditions.push(lte(consumerSignalSnapshots.snapshotAt, options.until))
  }

  return db
    .select()
    .from(consumerSignalSnapshots)
    .where(and(...conditions))
    .orderBy(desc(consumerSignalSnapshots.snapshotAt))
    .limit(limit)
}

/**
 * Get all signal snapshots for a user across all categories.
 * Used for GDPR Art. 15 right-of-access ("my data" endpoint).
 */
export async function getAllSignalHistory(
  userId: string,
  options?: { limit?: number }
): Promise<ConsumerSignalSnapshot[]> {
  return db
    .select()
    .from(consumerSignalSnapshots)
    .where(eq(consumerSignalSnapshots.userId, userId))
    .orderBy(desc(consumerSignalSnapshots.snapshotAt))
    .limit(options?.limit ?? 500)
}

// ── Retention cleanup ─────────────────────────────────────────────

/**
 * Delete signal snapshots older than SIGNAL_RETENTION_DAYS.
 * Called by the daily cron job.
 * Returns the number of rows deleted.
 */
export async function deleteExpiredSnapshots(): Promise<number> {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - SIGNAL_RETENTION_DAYS)

  const deleted = await db
    .delete(consumerSignalSnapshots)
    .where(lt(consumerSignalSnapshots.snapshotAt, cutoff))
    .returning({ id: consumerSignalSnapshots.id })

  return deleted.length
}

/**
 * Delete all signal snapshots for a user.
 * Called on GDPR/DPDP erasure request.
 * Returns the number of rows deleted.
 */
export async function deleteAllSnapshotsForUser(userId: string): Promise<number> {
  const deleted = await db
    .delete(consumerSignalSnapshots)
    .where(eq(consumerSignalSnapshots.userId, userId))
    .returning({ id: consumerSignalSnapshots.id })

  return deleted.length
}
