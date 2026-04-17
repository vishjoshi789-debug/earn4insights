/**
 * Payout Service
 *
 * Manages outgoing payments from platform to influencers and consumers.
 *
 * CURRENT STATE (launch):
 *   ALL payouts go to the admin manual queue regardless of method or region.
 *   RazorpayX (Payouts API) is not activated yet.
 *
 * FUTURE STATE (when RazorpayX is activated):
 *   India INR payouts → Razorpay Payouts API (automatic)
 *   International payouts → remain manual (Wise/PayPal/SWIFT)
 *
 * To activate RazorpayX: change `RAZORPAYX_ENABLED` to true and implement
 * the razorpayPayout() call inside initiateRecipientPayout().
 *
 * Retry policy: max 3 retries per payout (checked before retry).
 */

import 'server-only'

import { logDataAccess } from '@/lib/audit-log'
import { emit, PLATFORM_EVENTS } from '@/server/eventBus'
import {
  createPayout,
  getPayoutById,
  updatePayoutStatus,
  getPendingPayouts,
} from '@/db/repositories/razorpayRepository'
import { getPrimaryAccount } from '@/db/repositories/payoutAccountRepository'
import {
  getPaymentsByCampaign,
  getPaymentByMilestone,
} from '@/db/repositories/campaignPaymentRepository'
import { getCampaignById } from '@/db/repositories/influencerCampaignRepository'
import { getMilestonesByCampaign } from '@/db/repositories/campaignMilestoneRepository'

// ── Custom error classes ──────────────────────────────────────────

export class PayoutAccountMissingError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PayoutAccountMissingError'
  }
}

// ── Configuration ─────────────────────────────────────────────────

const MAX_RETRY_COUNT = 3

// TODO: Set to true when RazorpayX (Payouts API) is activated on your account.
// When true, India INR payouts will be sent automatically via Razorpay Payouts API.
// When false (current), ALL payouts go to admin manual queue.
const RAZORPAYX_ENABLED = false

// ═══════════════════════════════════════════════════════════════════
// INITIATE RECIPIENT PAYOUT
// ═══════════════════════════════════════════════════════════════════

/**
 * Create a payout record for a recipient (influencer or consumer).
 *
 * Current behavior: ALL payouts are created with status='pending' and
 * go to the admin manual queue at /admin/payouts.
 *
 * Future behavior (RAZORPAYX_ENABLED=true): India INR payouts will be
 * sent automatically. International payouts remain manual.
 */
export async function initiateRecipientPayout(params: {
  campaignId?: string
  recipientId: string
  recipientType: 'influencer' | 'consumer'
  amount: number
  currency: string
}): Promise<{ payoutId: string; method: string; status: string }> {
  const { campaignId, recipientId, recipientType, amount, currency } = params

  // Get recipient's primary payout account for this currency
  const account = await getPrimaryAccount(recipientId, currency)
  if (!account) {
    await logDataAccess({
      userId: recipientId,
      action: 'write',
      dataType: 'events',
      accessedBy: 'system',
      reason: 'Payout failed — no payout account',
      metadata: { campaignId, recipientType, currency, error: 'PayoutAccountMissingError' },
    })
    throw new PayoutAccountMissingError(
      `No primary payout account found for ${recipientType} ${recipientId} (currency: ${currency})`
    )
  }

  // Determine payout method based on account type
  const payoutMethod = resolvePayoutMethod(account.accountType, currency)

  // ── Razorpay Payouts API path (future) ──────────────────────────
  // When RAZORPAYX_ENABLED is true AND method is razorpay_payout:
  //   1. Call Razorpay Payouts API to create payout
  //   2. Save razorpay_payout_id
  //   3. Set status to 'processing'
  //
  // For now, ALL payouts start as 'pending' for admin manual processing.

  let status: 'pending' | 'processing' = 'pending'
  let razorpayPayoutId: string | null = null

  if (RAZORPAYX_ENABLED && payoutMethod === 'razorpay_payout') {
    // TODO: Wire Razorpay Payouts API here when RazorpayX is activated.
    // Example:
    //   const rpxResponse = await razorpayXCreatePayout({ ... })
    //   razorpayPayoutId = rpxResponse.id
    //   status = 'processing'
    //
    // For now, fall through to manual queue:
    status = 'pending'
  }

  // Create payout record
  const payout = await createPayout({
    campaignId: campaignId ?? null,
    recipientId,
    recipientType,
    payoutAccountId: account.id,
    amount,
    currency,
    payoutMethod,
    status,
    razorpayPayoutId,
    initiatedAt: new Date(),
  })

  // Audit log (never include account details)
  await logDataAccess({
    userId: recipientId,
    action: 'write',
    dataType: 'events',
    accessedBy: 'system',
    reason: 'Payout initiated',
    metadata: {
      payoutId: payout.id,
      campaignId,
      recipientType,
      amount,
      currency,
      payoutMethod,
      status,
      accountId: account.id,
    },
  })

  // Emit payout initiated event (non-fatal)
  await emit(PLATFORM_EVENTS.PAYMENT_PAYOUT_INITIATED, {
    actorId: 'system',
    payoutId: payout.id,
    recipientId,
    recipientType,
    amount,
    currency,
    method: payoutMethod,
  }).catch(() => {})

  return {
    payoutId: payout.id,
    method: payoutMethod,
    status,
  }
}

// ═══════════════════════════════════════════════════════════════════
// PROCESS PENDING PAYOUTS (Cron)
// ═══════════════════════════════════════════════════════════════════

/**
 * Find campaigns with released payments that haven't been paid out yet.
 * Creates payout records for each eligible recipient.
 *
 * Called by: /api/cron/process-payouts (daily)
 */
export async function processPendingPayouts(): Promise<{
  processed: number
  failed: number
  manual: number
}> {
  let processed = 0
  let failed = 0
  let manual = 0

  // Get all pending payouts (already created, waiting for admin)
  const pendingPayouts = await getPendingPayouts()
  // For now, all payouts are manual — nothing to auto-process
  manual = pendingPayouts.length

  await logDataAccess({
    userId: 'system',
    action: 'read',
    dataType: 'events',
    accessedBy: 'cron',
    reason: 'Process pending payouts cron run',
    metadata: { processed, failed, manual },
  })

  return { processed, failed, manual }
}

// ═══════════════════════════════════════════════════════════════════
// RETRY FAILED PAYOUT
// ═══════════════════════════════════════════════════════════════════

export async function retryFailedPayout(
  payoutId: string,
  adminId: string
): Promise<{ success: boolean; newStatus: string }> {
  const payout = await getPayoutById(payoutId)
  if (!payout) throw new Error(`Payout not found: ${payoutId}`)
  if (payout.status !== 'failed') throw new Error('Can only retry failed payouts')

  if (payout.retryCount >= MAX_RETRY_COUNT) {
    await logDataAccess({
      userId: payout.recipientId,
      action: 'write',
      dataType: 'events',
      accessedBy: adminId,
      reason: 'Payout retry rejected — max retries exceeded',
      metadata: { payoutId, retryCount: payout.retryCount, maxRetries: MAX_RETRY_COUNT },
    })
    throw new Error(`Payout ${payoutId} has exceeded max retries (${MAX_RETRY_COUNT})`)
  }

  // Reset to pending for admin manual processing
  const updated = await updatePayoutStatus(payoutId, {
    status: 'pending',
    retryCount: payout.retryCount + 1,
    failureReason: null,
    processedBy: adminId,
    adminNote: `Retry #${payout.retryCount + 1} initiated by admin`,
  })

  await logDataAccess({
    userId: payout.recipientId,
    action: 'write',
    dataType: 'events',
    accessedBy: adminId,
    reason: 'Payout retry initiated',
    metadata: {
      payoutId,
      retryCount: updated.retryCount,
      amount: payout.amount,
      currency: payout.currency,
    },
  })

  return { success: true, newStatus: updated.status }
}

// ═══════════════════════════════════════════════════════════════════
// ADMIN: MARK PAYOUT AS PROCESSING / COMPLETED
// ═══════════════════════════════════════════════════════════════════

export async function markPayoutProcessing(
  payoutId: string,
  adminId: string,
  note?: string
): Promise<void> {
  const payout = await getPayoutById(payoutId)
  if (!payout) throw new Error(`Payout not found: ${payoutId}`)
  if (payout.status !== 'pending') throw new Error('Can only process pending payouts')

  await updatePayoutStatus(payoutId, {
    status: 'processing',
    processedBy: adminId,
    adminNote: note ?? null,
  })

  await logDataAccess({
    userId: payout.recipientId,
    action: 'write',
    dataType: 'events',
    accessedBy: adminId,
    reason: 'Payout marked as processing by admin',
    metadata: { payoutId, amount: payout.amount, currency: payout.currency },
  })
}

export async function markPayoutCompleted(
  payoutId: string,
  adminId: string,
  transferReference?: string,
  note?: string
): Promise<void> {
  const payout = await getPayoutById(payoutId)
  if (!payout) throw new Error(`Payout not found: ${payoutId}`)
  if (payout.status !== 'processing' && payout.status !== 'pending') {
    throw new Error('Can only complete pending or processing payouts')
  }

  await updatePayoutStatus(payoutId, {
    status: 'completed',
    completedAt: new Date(),
    processedBy: adminId,
    wiseTransferId: transferReference ?? null,
    adminNote: note ?? null,
  })

  await logDataAccess({
    userId: payout.recipientId,
    action: 'write',
    dataType: 'events',
    accessedBy: adminId,
    reason: 'Payout completed by admin',
    metadata: {
      payoutId,
      amount: payout.amount,
      currency: payout.currency,
      transferReference,
    },
  })

  // Emit payout completed event (non-fatal)
  await emit(PLATFORM_EVENTS.PAYMENT_PAYOUT_COMPLETED, {
    actorId: adminId,
    actorRole: 'admin',
    payoutId,
    recipientId: payout.recipientId,
    amount: payout.amount,
    currency: payout.currency,
    method: payout.payoutMethod,
  }).catch(() => {})
}

export async function markPayoutFailed(
  payoutId: string,
  adminId: string,
  reason: string
): Promise<void> {
  const payout = await getPayoutById(payoutId)
  if (!payout) throw new Error(`Payout not found: ${payoutId}`)
  if (payout.status === 'completed') {
    throw new Error('Cannot mark a completed payout as failed')
  }

  await updatePayoutStatus(payoutId, {
    status: 'failed',
    failureReason: reason,
    processedBy: adminId,
  })

  await logDataAccess({
    userId: payout.recipientId,
    action: 'write',
    dataType: 'events',
    accessedBy: adminId,
    reason: 'Payout marked failed by admin',
    metadata: { payoutId, failureReason: reason },
  })

  // Emit payout failed event (non-fatal)
  await emit(PLATFORM_EVENTS.PAYMENT_PAYOUT_FAILED, {
    actorId: adminId,
    actorRole: 'admin',
    payoutId,
    recipientId: payout.recipientId,
    amount: payout.amount,
    failureReason: reason,
  }).catch(() => {})
}

// ═══════════════════════════════════════════════════════════════════
// GET PAYOUT STATUS
// ═══════════════════════════════════════════════════════════════════

export async function getPayoutStatus(payoutId: string) {
  const payout = await getPayoutById(payoutId)
  if (!payout) throw new Error(`Payout not found: ${payoutId}`)

  // TODO: When RazorpayX is enabled, poll Razorpay API for processing payouts:
  //   if (RAZORPAYX_ENABLED && payout.razorpayPayoutId && payout.status === 'processing') {
  //     const rpxStatus = await razorpayXGetPayoutStatus(payout.razorpayPayoutId)
  //     // Update local record if status changed
  //   }

  return {
    id: payout.id,
    status: payout.status,
    amount: payout.amount,
    currency: payout.currency,
    payoutMethod: payout.payoutMethod,
    initiatedAt: payout.initiatedAt,
    completedAt: payout.completedAt,
    failureReason: payout.failureReason,
    retryCount: payout.retryCount,
  }
}

// ── Helpers ───────────────────────────────────────────────────────

/**
 * Map account type + currency to payout method.
 *
 * Current: all methods are manual (admin processes).
 * Future: 'razorpay_payout' for India INR bank/UPI when RazorpayX is active.
 */
function resolvePayoutMethod(
  accountType: string,
  currency: string
): 'razorpay_payout' | 'wise_manual' | 'paypal_manual' | 'bank_manual' {
  // India INR → Razorpay Payout (when ready)
  if (currency === 'INR' && (accountType === 'bank_account' || accountType === 'upi')) {
    return 'razorpay_payout'
  }

  // International methods
  if (accountType === 'wise') return 'wise_manual'
  if (accountType === 'paypal') return 'paypal_manual'

  // SWIFT / anything else
  return 'bank_manual'
}
