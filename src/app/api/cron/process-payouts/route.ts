/**
 * Process Payouts Cron
 * GET /api/cron/process-payouts
 *
 * Schedule: daily 6 AM UTC (vercel.json)
 *
 * 1. Find campaign_payments with status='released' that have no
 *    corresponding influencer_payouts record → create payout.
 * 2. Retry failed payouts where retry_count < 3 and
 *    updated_at < 1 hour ago (cool-down).
 *
 * Auth: CRON_SECRET via Authorization: Bearer header.
 */

import { NextRequest, NextResponse } from 'next/server'
import { logDataAccess } from '@/lib/audit-log'
import {
  initiateRecipientPayout,
  retryFailedPayout,
} from '@/server/payoutService'
import { db } from '@/db'
import { campaignPayments, influencerPayouts, campaignInfluencers } from '@/db/schema'
import { eq, and, sql, lt } from 'drizzle-orm'

function verifyAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET || process.env.AUTH_SECRET
  return authHeader === `Bearer ${cronSecret}`
}

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  console.log('[CRON] Starting process-payouts...')

  if (!verifyAuth(request)) {
    console.error('[CRON] Unauthorized process-payouts attempt')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let processed = 0
  let retried = 0
  let failed = 0
  let manual = 0
  const errors: string[] = []

  try {
    // ── Step 1: Find released campaign_payments without payouts ──────
    // Use NOT EXISTS subquery to find payments that have no matching payout
    const releasedWithoutPayout = await db
      .select({
        paymentId: campaignPayments.id,
        campaignId: campaignPayments.campaignId,
        amount: campaignPayments.influencerAmount,
        totalAmount: campaignPayments.amount,
        platformFee: campaignPayments.platformFee,
        currency: campaignPayments.currency,
      })
      .from(campaignPayments)
      .where(
        and(
          eq(campaignPayments.status, 'released'),
          sql`NOT EXISTS (
            SELECT 1 FROM ${influencerPayouts}
            WHERE ${influencerPayouts.campaignId} = ${campaignPayments.campaignId}
          )`
        )
      )

    for (const payment of releasedWithoutPayout) {
      try {
        // Find the influencer assigned to this campaign
        const invitation = await db
          .select({ influencerId: campaignInfluencers.influencerId })
          .from(campaignInfluencers)
          .where(
            and(
              eq(campaignInfluencers.campaignId, payment.campaignId),
              sql`${campaignInfluencers.status} IN ('accepted', 'active', 'completed')`
            )
          )
          .limit(1)

        if (!invitation[0]) {
          errors.push(`No active influencer for campaign ${payment.campaignId}`)
          failed++
          continue
        }

        const influencerAmount = payment.amount ?? (payment.totalAmount - (payment.platformFee ?? 0))

        await initiateRecipientPayout({
          campaignId: payment.campaignId,
          recipientId: invitation[0].influencerId,
          recipientType: 'influencer',
          amount: influencerAmount,
          currency: payment.currency,
        })

        processed++
      } catch (err) {
        failed++
        errors.push(
          `Payment ${payment.paymentId}: ${err instanceof Error ? err.message : 'Unknown error'}`
        )
      }
    }

    // ── Step 2: Retry failed payouts (cool-down: > 1 hour old) ──────
    const oneHourAgo = new Date(Date.now() - 3_600_000)
    const failedPayouts = await db
      .select()
      .from(influencerPayouts)
      .where(
        and(
          eq(influencerPayouts.status, 'failed'),
          lt(influencerPayouts.updatedAt, oneHourAgo),
          sql`${influencerPayouts.retryCount} < 3`
        )
      )

    for (const payout of failedPayouts) {
      try {
        await retryFailedPayout(payout.id, 'system-cron')
        retried++
      } catch (err) {
        failed++
        errors.push(
          `Retry ${payout.id}: ${err instanceof Error ? err.message : 'Unknown error'}`
        )
      }
    }

    manual = processed // All payouts currently go to manual queue

  } catch (err) {
    console.error('[CRON] process-payouts critical error:', err)
    errors.push(`Critical: ${err instanceof Error ? err.message : 'Unknown error'}`)
  }

  const duration = Date.now() - startTime

  await logDataAccess({
    userId: 'system',
    action: 'write',
    dataType: 'events',
    accessedBy: 'cron',
    reason: 'Process payouts cron completed',
    metadata: { processed, retried, failed, manual, duration, errors: errors.slice(0, 10) },
  })

  console.log(`[CRON] process-payouts done in ${duration}ms: processed=${processed} retried=${retried} failed=${failed}`)

  return NextResponse.json({
    success: true,
    processed,
    retried,
    failed,
    manual,
    duration,
    errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
  })
}
