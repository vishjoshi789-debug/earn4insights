/**
 * Cron: Cleanup Notifications
 * GET /api/cron/cleanup-notifications
 *
 * Runs daily at 00:30 UTC (see vercel.json).
 *
 * Purges:
 *  1. notification_inbox rows where expiresAt < NOW() (90-day TTL)
 *  2. activity_feed_items older than 90 days
 *
 * Auth: Bearer CRON_SECRET header (Vercel Cron injects automatically).
 */

import { NextRequest, NextResponse } from 'next/server'
import { deleteExpiredItems } from '@/db/repositories/notificationInboxRepository'
import { deleteOldFeedItems } from '@/db/repositories/activityFeedRepository'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results = {
    inboxItemsDeleted:    0,
    feedItemsDeleted:     0,
    errors:               [] as string[],
  }

  // ── 1. Purge expired notification_inbox rows ─────────────────────────────
  try {
    results.inboxItemsDeleted = await deleteExpiredItems()
  } catch (err: any) {
    results.errors.push(`inbox cleanup: ${err?.message ?? String(err)}`)
  }

  // ── 2. Purge old activity_feed_items (90-day retention) ──────────────────
  try {
    results.feedItemsDeleted = await deleteOldFeedItems(90)
  } catch (err: any) {
    results.errors.push(`feed cleanup: ${err?.message ?? String(err)}`)
  }

  const success = results.errors.length === 0

  return NextResponse.json({
    success,
    timestamp: new Date().toISOString(),
    ...results,
  }, { status: success ? 200 : 207 })
}
