/**
 * Sync Razorpay Status Cron
 * GET /api/cron/sync-razorpay-status
 *
 * Schedule: daily 7 AM UTC via vercel.json (placeholder).
 * For real-time sync, use cron-job.org every 6 hours.
 *
 * Polls Razorpay for status of 'processing' payouts that have a
 * razorpay_payout_id and haven't been updated in the last hour.
 *
 * Currently a no-op since RAZORPAYX_ENABLED = false (all payouts manual).
 * When RazorpayX is activated, this will poll the Payouts API.
 *
 * Auth: CRON_SECRET via Authorization: Bearer header.
 */

import { NextRequest, NextResponse } from 'next/server'
import { logDataAccess } from '@/lib/audit-log'
import { getProcessingPayoutsOlderThan, updatePayoutStatus } from '@/db/repositories/razorpayRepository'
import { emit, PLATFORM_EVENTS } from '@/server/eventBus'

function verifyAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET || process.env.AUTH_SECRET
  return authHeader === `Bearer ${cronSecret}`
}

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  console.log('[CRON] Starting sync-razorpay-status...')

  if (!verifyAuth(request)) {
    console.error('[CRON] Unauthorized sync-razorpay-status attempt')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let checked = 0
  let updated = 0
  let errorCount = 0
  const errors: string[] = []

  try {
    // Find payouts in 'processing' status that haven't been updated in 1 hour
    const oneHourAgo = new Date(Date.now() - 3_600_000)
    const processingPayouts = await getProcessingPayoutsOlderThan(oneHourAgo)

    checked = processingPayouts.length

    for (const payout of processingPayouts) {
      try {
        // Only poll Razorpay for payouts that have a razorpay_payout_id
        if (!payout.razorpayPayoutId) {
          // Manual payout in 'processing' — skip (admin handles these)
          continue
        }

        // TODO: When RazorpayX is activated, poll the Payouts API here:
        //   const rpxStatus = await razorpayXGetPayoutStatus(payout.razorpayPayoutId)
        //   if (rpxStatus === 'processed') {
        //     await updatePayoutStatus(payout.id, {
        //       status: 'completed',
        //       completedAt: new Date(),
        //     })
        //     await emit(PLATFORM_EVENTS.PAYMENT_PAYOUT_COMPLETED, {
        //       actorId: 'system',
        //       payoutId: payout.id,
        //       recipientId: payout.recipientId,
        //       amount: payout.amount,
        //       currency: payout.currency,
        //       method: payout.payoutMethod,
        //     })
        //     updated++
        //   } else if (rpxStatus === 'failed' || rpxStatus === 'reversed') {
        //     await updatePayoutStatus(payout.id, {
        //       status: 'failed',
        //       failureReason: `RazorpayX status: ${rpxStatus}`,
        //     })
        //     await emit(PLATFORM_EVENTS.PAYMENT_PAYOUT_FAILED, {
        //       actorId: 'system',
        //       payoutId: payout.id,
        //       recipientId: payout.recipientId,
        //       amount: payout.amount,
        //       failureReason: `RazorpayX status: ${rpxStatus}`,
        //     })
        //     updated++
        //   }
        // For now, just log — no API call until RazorpayX is activated

      } catch (err) {
        errorCount++
        errors.push(
          `Payout ${payout.id}: ${err instanceof Error ? err.message : 'Unknown error'}`
        )
      }
    }
  } catch (err) {
    console.error('[CRON] sync-razorpay-status critical error:', err)
    errors.push(`Critical: ${err instanceof Error ? err.message : 'Unknown error'}`)
  }

  const duration = Date.now() - startTime

  await logDataAccess({
    userId: 'system',
    action: 'read',
    dataType: 'events',
    accessedBy: 'cron',
    reason: 'Sync Razorpay status cron completed',
    metadata: { checked, updated, errors: errorCount, duration },
  })

  console.log(`[CRON] sync-razorpay-status done in ${duration}ms: checked=${checked} updated=${updated} errors=${errorCount}`)

  return NextResponse.json({
    success: true,
    checked,
    updated,
    errors: errorCount,
    duration,
  })
}
