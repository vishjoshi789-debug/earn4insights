/**
 * Consumer Notifications API
 *
 * GET /api/consumer/notifications
 *   Returns the 20 most recent notification_queue items for the logged-in consumer.
 *   Used by the dashboard header bell dropdown.
 *
 * Consumers see notifications like "New survey available", "Survey submitted", etc.
 * The notification_queue is already populated by queueNotification() calls.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { db } from '@/db'
import { notificationQueue } from '@/db/schema'
import { eq, desc, and, gte } from 'drizzle-orm'

export async function GET(_req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Show notifications from the last 30 days
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 30)

    const notifications = await db
      .select()
      .from(notificationQueue)
      .where(
        and(
          eq(notificationQueue.userId, userId),
          gte(notificationQueue.createdAt, cutoff),
        ),
      )
      .orderBy(desc(notificationQueue.createdAt))
      .limit(20)

    return NextResponse.json({ notifications })
  } catch (error) {
    console.error('[ConsumerNotifications GET] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
