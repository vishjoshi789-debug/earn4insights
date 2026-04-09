import 'server-only'

import { db } from '@/db'
import {
  notificationInbox,
  type NotificationInboxItem,
  type NewNotificationInboxItem,
} from '@/db/schema'
import { eq, and, desc, lt, isNull, sql } from 'drizzle-orm'

// ── Inbox expiry ──────────────────────────────────────────────────────────

/** Notifications expire after 90 days */
export function getInboxExpiryDate(): Date {
  const d = new Date()
  d.setDate(d.getDate() + 90)
  return d
}

// ── Writes ────────────────────────────────────────────────────────────────

/**
 * Insert a notification into a user's inbox.
 * Sets expiresAt to 90 days from now automatically.
 */
export async function createInboxItem(
  data: Omit<NewNotificationInboxItem, 'id' | 'createdAt' | 'expiresAt' | 'isRead' | 'readAt'> & {
    expiresAt?: Date
  }
): Promise<NotificationInboxItem> {
  const [row] = await db
    .insert(notificationInbox)
    .values({
      ...data,
      expiresAt: data.expiresAt ?? getInboxExpiryDate(),
      isRead: false,
    })
    .returning()
  return row
}

/**
 * Mark a single notification as read.
 * Only marks if it belongs to the given userId (prevents cross-user access).
 */
export async function markItemRead(
  itemId: string,
  userId: string
): Promise<boolean> {
  const result = await db
    .update(notificationInbox)
    .set({ isRead: true, readAt: new Date() })
    .where(
      and(
        eq(notificationInbox.id, itemId),
        eq(notificationInbox.userId, userId)
      )
    )
    .returning({ id: notificationInbox.id })

  return result.length > 0
}

/**
 * Mark a single notification as unread.
 */
export async function markItemUnread(
  itemId: string,
  userId: string
): Promise<boolean> {
  const result = await db
    .update(notificationInbox)
    .set({ isRead: false, readAt: null })
    .where(
      and(
        eq(notificationInbox.id, itemId),
        eq(notificationInbox.userId, userId)
      )
    )
    .returning({ id: notificationInbox.id })

  return result.length > 0
}

/**
 * Mark ALL notifications as read for a user.
 * Returns the count of items updated.
 */
export async function markAllRead(userId: string): Promise<number> {
  const result = await db
    .update(notificationInbox)
    .set({ isRead: true, readAt: new Date() })
    .where(
      and(
        eq(notificationInbox.userId, userId),
        eq(notificationInbox.isRead, false)
      )
    )
    .returning({ id: notificationInbox.id })

  return result.length
}

/**
 * Soft-delete (dismiss) a notification item.
 */
export async function deleteInboxItem(
  itemId: string,
  userId: string
): Promise<boolean> {
  const result = await db
    .delete(notificationInbox)
    .where(
      and(
        eq(notificationInbox.id, itemId),
        eq(notificationInbox.userId, userId)
      )
    )
    .returning({ id: notificationInbox.id })

  return result.length > 0
}

/**
 * Purge all expired notifications (expiresAt < now()).
 * Called by the cleanup-notifications cron.
 * Returns the count deleted.
 */
export async function deleteExpiredItems(): Promise<number> {
  const result = await db
    .delete(notificationInbox)
    .where(lt(notificationInbox.expiresAt, new Date()))
    .returning({ id: notificationInbox.id })

  return result.length
}

// ── Reads ─────────────────────────────────────────────────────────────────

export interface GetInboxOptions {
  /** Only return unread notifications */
  unreadOnly?: boolean
  /** Filter by notification type */
  type?: string
  /** Cursor-based pagination: return items created before this timestamp */
  before?: Date
  limit?: number
}

/**
 * Get a user's notification inbox, newest first.
 * Excludes expired items automatically.
 */
export async function getInbox(
  userId: string,
  options: GetInboxOptions = {}
): Promise<NotificationInboxItem[]> {
  const { unreadOnly = false, type, before, limit = 20 } = options

  const conditions = [
    eq(notificationInbox.userId, userId),
    // Exclude expired
    sql`${notificationInbox.expiresAt} > NOW()`,
  ]

  if (unreadOnly) {
    conditions.push(eq(notificationInbox.isRead, false))
  }
  if (type) {
    conditions.push(eq(notificationInbox.type, type))
  }
  if (before) {
    conditions.push(lt(notificationInbox.createdAt, before))
  }

  return db
    .select()
    .from(notificationInbox)
    .where(and(...conditions))
    .orderBy(desc(notificationInbox.createdAt))
    .limit(limit)
}

/**
 * Get the unread notification count for a user.
 * Used for the bell badge.
 */
export async function getUnreadCount(userId: string): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(notificationInbox)
    .where(
      and(
        eq(notificationInbox.userId, userId),
        eq(notificationInbox.isRead, false),
        sql`${notificationInbox.expiresAt} > NOW()`
      )
    )

  return result[0]?.count ?? 0
}
