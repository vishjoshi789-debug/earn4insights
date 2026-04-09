import 'server-only'

import { db } from '@/db'
import {
  realtimeEvents,
  type RealtimeEvent,
  type NewRealtimeEvent,
} from '@/db/schema'
import { eq, desc, and, gte } from 'drizzle-orm'

// ── Writes ────────────────────────────────────────────────────────────────

/**
 * Create an audit record for a platform event.
 * Called by eventBus.ts before dispatching notifications.
 */
export async function createRealtimeEvent(
  data: Omit<NewRealtimeEvent, 'id' | 'createdAt'>
): Promise<RealtimeEvent> {
  const [row] = await db
    .insert(realtimeEvents)
    .values(data)
    .returning()
  return row
}

/**
 * Mark an event as processed (notifications dispatched).
 */
export async function markEventProcessed(eventId: string): Promise<void> {
  await db
    .update(realtimeEvents)
    .set({ processedAt: new Date() })
    .where(eq(realtimeEvents.id, eventId))
}

// ── Reads ─────────────────────────────────────────────────────────────────

/**
 * Get recent events by type, optionally limited to a time window.
 */
export async function getRecentEventsByType(
  eventType: string,
  options?: { sinceMinutes?: number; limit?: number }
): Promise<RealtimeEvent[]> {
  const { sinceMinutes = 60, limit = 100 } = options ?? {}
  const since = new Date(Date.now() - sinceMinutes * 60 * 1000)

  return db
    .select()
    .from(realtimeEvents)
    .where(
      and(
        eq(realtimeEvents.eventType, eventType),
        gte(realtimeEvents.createdAt, since)
      )
    )
    .orderBy(desc(realtimeEvents.createdAt))
    .limit(limit)
}

/**
 * Get events for a specific target entity (e.g. all events about product X).
 */
export async function getEventsForEntity(
  entityType: string,
  entityId: string,
  limit = 50
): Promise<RealtimeEvent[]> {
  return db
    .select()
    .from(realtimeEvents)
    .where(
      and(
        eq(realtimeEvents.targetEntityType, entityType),
        eq(realtimeEvents.targetEntityId, entityId)
      )
    )
    .orderBy(desc(realtimeEvents.createdAt))
    .limit(limit)
}
