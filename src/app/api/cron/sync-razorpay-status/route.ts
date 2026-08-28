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
import { withCronRun } from '@/lib/cron/withCronRun'
import { logDataAccess } from '@/lib/audit-log'
import { getProcessingPayoutsOlderThan, updatePayoutStatus } from '@/db/repositories/razorpayRepository'
import { emit, PLATFORM_EVENTS } from '@/server/eventBus'
import { db } from '@/db'
import { sql } from 'drizzle-orm'

function verifyAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET || process.env.AUTH_SECRET
  return authHeader === `Bearer ${cronSecret}`
}

// Run-recording (migration 037). ⚠️ `verifyAuth` uses CRON_SECRET ||
// AUTH_SECRET — left untouched inside the handler.
export const GET = withCronRun('sync-razorpay-status', handleGET, {
  secretEnv: ['CRON_SECRET', 'AUTH_SECRET'], // matches inline verifyAuth
})

async function handleGET(request: NextRequest) {
  const startTime = Date.now()
  console.log('[CRON] Starting sync-razorpay-status...')

  if (!verifyAuth(request)) {
    console.error('[CRON] Unauthorized sync-razorpay-status attempt')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let checked = 0
  let updated = 0
  let errorCount = 0
  let criticalError = false
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
    criticalError = true
  }

  // ══════════════════════════════════════════════════════════════════
  // PAYMENT LEDGER INVARIANTS
  // ══════════════════════════════════════════════════════════════════
  //
  // 🔴 ESCALATION RULE — READ THIS BEFORE TRIAGING A FAILURE.
  //
  // A non-zero result ON PRODUCTION means REAL MONEY MOVED WITHOUT A LEDGER
  // ROW. That is an ALARM, not a backlog item. Both invariants are supposed to
  // be structurally impossible: violating one means the write path is broken,
  // and every subsequent payment is at risk until it is found. Stop and
  // investigate before the next payment is taken.
  //
  // A non-zero result on PREVIEW is almost always a test artefact and can be
  // investigated at leisure.
  //
  // Why it lives HERE rather than in a script: a check someone has to remember
  // to run is a check that stops being run. This cron already sits in the
  // payment domain, runs at 07:00 UTC — one hour after process-payouts at
  // 06:00, so it inspects the ledger immediately after the job that writes to
  // it — and was otherwise a no-op while RAZORPAYX_ENABLED is false. It also
  // costs no new vercel.json entry (there are already 33).
  //
  // Returning 500 is what makes withCronRun record status='error' rather than
  // 'ok', so a violation is visible in cron_runs without anyone querying.
  const invariantViolations: Record<string, unknown[]> = {}
  try {
    // (A) Every paid/refunded Razorpay order must have EXACTLY ONE ledger row.
    // Zero = money moved and was never recorded. More than one = double-count.
    const ledgerRaw = await db.execute(sql`
      SELECT o.razorpay_order_id, o.status AS order_status, count(p.id)::int AS ledger_rows
      FROM razorpay_orders o
      LEFT JOIN campaign_payments p ON p.razorpay_order_id = o.razorpay_order_id
      WHERE o.status IN ('paid','refunded')
      GROUP BY o.razorpay_order_id, o.status
      HAVING count(p.id) <> 1
    `)
    const ledgerRows = Array.isArray(ledgerRaw) ? ledgerRaw : ((ledgerRaw as any)?.rows ?? [])
    if (ledgerRows.length > 0) invariantViolations.ordersWithoutOneLedgerRow = ledgerRows

    // (B) No released payment may have more than one payout. This is the
    // regression guard for the campaign_id-vs-payment_id dedup (migration 038)
    // — under the old predicate a second payout was impossible for a different
    // reason, so this only became meaningful once the dedup keyed on payment.
    const payoutRaw = await db.execute(sql`
      SELECT cp.id AS payment_id, cp.campaign_id, count(po.id)::int AS payouts
      FROM campaign_payments cp
      LEFT JOIN influencer_payouts po ON po.campaign_payment_id = cp.id
      WHERE cp.status = 'released'
      GROUP BY cp.id, cp.campaign_id
      HAVING count(po.id) > 1
    `)
    const payoutRows = Array.isArray(payoutRaw) ? payoutRaw : ((payoutRaw as any)?.rows ?? [])
    if (payoutRows.length > 0) invariantViolations.paymentsWithMultiplePayouts = payoutRows
  } catch (err) {
    // A guard that cannot run is not a passing guard. Surface it as a failure
    // rather than letting a broken check read as a clean ledger.
    console.error('[CRON] ledger invariant check FAILED to run:', err)
    errors.push(`Invariant check failed to run: ${err instanceof Error ? err.message : 'Unknown'}`)
    criticalError = true
  }

  const violationCount = Object.values(invariantViolations).reduce((n, v) => n + v.length, 0)
  if (violationCount > 0) {
    console.error(
      `[CRON] 🔴 LEDGER INVARIANT VIOLATED — ${violationCount} row(s):`,
      JSON.stringify(invariantViolations),
    )
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

  // Same shape as the process-payouts fix: `success: true` used to be a
  // hardcoded literal here too, so a crashed sync — or a violated invariant —
  // returned 200 and was recorded as a clean run.
  const failed = criticalError || violationCount > 0
  return NextResponse.json(
    {
      success: !failed && errorCount === 0,
      criticalError,
      checked,
      updated,
      errors: errorCount,
      errorDetail: errors.length > 0 ? errors.slice(0, 10) : undefined,
      ledgerInvariants:
        violationCount > 0
          ? { violated: true, count: violationCount, ...invariantViolations }
          : { violated: false },
      duration,
    },
    { status: failed ? 500 : 200 },
  )
}
