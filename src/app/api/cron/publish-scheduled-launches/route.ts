/**
 * Cron: Publish Scheduled Product Launches
 * GET /api/cron/publish-scheduled-launches
 *
 * Runs every 15 minutes (see vercel.json).
 *
 * For each product where launch_status='scheduled' AND scheduled_launch_at <= NOW():
 *   1. Flip launch_status -> 'live' (publishScheduledProduct — race-safe, no-op
 *      if a concurrent run already published it).
 *   2. Send the brand confirmation email (Resend).
 *   3. Fire smart distribution notifications to ICP-matched consumers.
 *   4. Fan out to watchlist subscribers.
 *
 * These are exactly the same side-effects launch.actions.ts performs for
 * the "instant" branch — deferred here until the scheduled time arrives.
 *
 * Errors in any one step are caught per-product so a single failure does
 * not block the rest of the queue.
 *
 * Auth: Bearer CRON_SECRET header (Vercel Cron injects automatically).
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  getDueScheduledProducts,
  publishScheduledProduct,
} from '@/db/repositories/productRepository'
import { findUserById } from '@/db/repositories/userRepository'
import { sendProductLaunchedEmail } from '@/server/productNotifications'
import { triggerProductLaunchNotifications } from '@/lib/personalization/smartDistributionService'
import { notifyWatchersOnLaunch } from '@/server/watchlistService'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startedAt = new Date().toISOString()
  const summary = {
    found: 0,
    published: 0,
    emailsSent: 0,
    notificationsTriggered: 0,
    watchersNotified: 0,
    skipped: 0,
    errors: [] as Array<{ productId: string; step: string; message: string }>,
  }

  try {
    const due = await getDueScheduledProducts()
    summary.found = due.length

    for (const product of due) {
      const published = await publishScheduledProduct(product.id)
      if (!published) {
        // Lost the race — another cron pass (or a manual publish) flipped
        // it first. Don't double-fire the side-effects.
        summary.skipped += 1
        continue
      }
      summary.published += 1

      // Brand confirmation email — same path as instant launch.
      if (product.ownerId) {
        try {
          const owner = await findUserById(product.ownerId)
          if (owner?.email) {
            const r = await sendProductLaunchedEmail({
              brandEmail: owner.email,
              brandName: owner.name ?? null,
              productId: product.id,
              productName: product.name,
            })
            if (r?.success !== false) summary.emailsSent += 1
          }
        } catch (err) {
          summary.errors.push({
            productId: product.id,
            step: 'brand_email',
            message: err instanceof Error ? err.message : String(err),
          })
        }
      }

      // Smart distribution to ICP-matched consumers — queued, non-blocking.
      try {
        await triggerProductLaunchNotifications(product.id)
        summary.notificationsTriggered += 1
      } catch (err) {
        summary.errors.push({
          productId: product.id,
          step: 'smart_distribution',
          message: err instanceof Error ? err.message : String(err),
        })
      }

      // Watchlist fan-out.
      try {
        await notifyWatchersOnLaunch(product.id)
        summary.watchersNotified += 1
      } catch (err) {
        summary.errors.push({
          productId: product.id,
          step: 'watchlist',
          message: err instanceof Error ? err.message : String(err),
        })
      }
    }

    const ok = summary.errors.length === 0
    return NextResponse.json(
      {
        success: ok,
        startedAt,
        finishedAt: new Date().toISOString(),
        ...summary,
      },
      { status: ok ? 200 : 207 },
    )
  } catch (err) {
    console.error('[publish-scheduled-launches] fatal:', err)
    return NextResponse.json(
      {
        success: false,
        startedAt,
        message: err instanceof Error ? err.message : String(err),
        ...summary,
      },
      { status: 500 },
    )
  }
}
