import 'server-only'

import { db } from '@/db'
import {
  activityFeedItems,
  type ActivityFeedItem,
  type NewActivityFeedItem,
} from '@/db/schema'
import { eq, desc, lt, and, sql } from 'drizzle-orm'

// ── Writes ────────────────────────────────────────────────────────────────

/**
 * Insert an activity feed item for a user.
 */
export async function createFeedItem(
  data: Omit<NewActivityFeedItem, 'id' | 'createdAt'>
): Promise<ActivityFeedItem> {
  const [row] = await db
    .insert(activityFeedItems)
    .values(data)
    .returning()
  return row
}

/**
 * Purge activity feed items older than retentionDays (default 90).
 * Called by the cleanup-notifications cron.
 * Returns count deleted.
 */
export async function deleteOldFeedItems(retentionDays = 90): Promise<number> {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)
  const result = await db
    .delete(activityFeedItems)
    .where(lt(activityFeedItems.createdAt, cutoff))
    .returning({ id: activityFeedItems.id })

  return result.length
}

// ── Reads ─────────────────────────────────────────────────────────────────

export interface GetFeedOptions {
  /** Cursor-based pagination: return items created before this timestamp */
  before?: Date
  /** Filter by event type */
  eventType?: string
  limit?: number
}

/**
 * Get a user's activity feed, newest first.
 * Supports cursor-based infinite scroll via `before`.
 */
export async function getFeed(
  userId: string,
  options: GetFeedOptions = {}
): Promise<ActivityFeedItem[]> {
  const { before, eventType, limit = 20 } = options

  const conditions = [eq(activityFeedItems.userId, userId)]

  if (before) {
    conditions.push(lt(activityFeedItems.createdAt, before))
  }
  if (eventType) {
    conditions.push(eq(activityFeedItems.eventType, eventType))
  }

  return db
    .select()
    .from(activityFeedItems)
    .where(and(...conditions))
    .orderBy(desc(activityFeedItems.createdAt))
    .limit(limit)
}

/**
 * Get the latest N feed items for a user (used for dashboard home widget).
 */
export async function getLatestFeedItems(
  userId: string,
  limit = 10
): Promise<ActivityFeedItem[]> {
  return getFeed(userId, { limit })
}
