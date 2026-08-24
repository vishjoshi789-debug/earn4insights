/**
 * Razorpay Payment Service
 *
 * Handles all Razorpay payment operations:
 *   - Order creation (brand pays for campaign)
 *   - Payment signature verification (crypto.createHmac, NOT SDK)
 *   - Payment capture
 *   - Refunds (full or partial)
 *
 * Platform fee schedule:
 *   milestone → 8%   |   direct → 12%   |   escrow/standard → 10%
 *
 * Security:
 *   - All actions logged to auditLog
 *   - Never logs full payment credentials
 *   - Signature verification uses crypto, not Razorpay SDK
 */

import 'server-only'

import { createHmac, timingSafeEqual } from 'crypto'
import { logDataAccess } from '@/lib/audit-log'
import { emit, PLATFORM_EVENTS } from '@/server/eventBus'
import {
  createOrder as createOrderRecord,
  getOrderByRazorpayId,
  updateOrderStatus,
} from '@/db/repositories/razorpayRepository'
import {
  createPayment,
  updatePaymentStatus,
  getPaymentsByCampaign,
  getPaymentByRazorpayOrderId,
  claimPaymentEscrowed,
} from '@/db/repositories/campaignPaymentRepository'
import { getCampaignById } from '@/db/repositories/influencerCampaignRepository'

// ── Custom error classes ──────────────────────────────────────────

export class PaymentVerificationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PaymentVerificationError'
  }
}

export class DuplicatePaymentError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DuplicatePaymentError'
  }
}

/**
 * A campaign may pay at the campaign level OR per milestone — never both.
 * Distinct from DuplicatePaymentError because the caller's fix is different:
 * a duplicate means "you already paid this", whereas this means "you are
 * paying at the wrong granularity for this campaign". Routes map it to 400.
 */
export class MixedPaymentGranularityError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MixedPaymentGranularityError'
  }
}

export class InsufficientFundsError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InsufficientFundsError'
  }
}

// ── Fee calculation ───────────────────────────────────────────────

const FEE_SCHEDULE: Record<string, number> = {
  milestone: 8,
  escrow: 10,
  direct: 12,
}

function calculatePlatformFee(amount: number, paymentType: string): {
  platformFee: number
  influencerAmount: number
  feePercent: number
} {
  const feePercent = FEE_SCHEDULE[paymentType] ?? 10
  const platformFee = Math.round(amount * (feePercent / 100))
  const influencerAmount = amount - platformFee
  return { platformFee, influencerAmount, feePercent }
}

// ── Razorpay API helpers ──────────────────────────────────────────

function getRazorpayCredentials(): { keyId: string; keySecret: string } {
  const keyId = process.env.RAZORPAY_KEY_ID
  const keySecret = process.env.RAZORPAY_KEY_SECRET
  if (!keyId || !keySecret) {
    throw new Error('RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be set')
  }
  return { keyId, keySecret }
}

/**
 * Make an authenticated request to Razorpay API.
 * Uses Basic Auth (keyId:keySecret).
 */
async function razorpayFetch(
  path: string,
  options: { method: string; body?: Record<string, unknown> }
): Promise<any> {
  const { keyId, keySecret } = getRazorpayCredentials()
  const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64')

  const response = await fetch(`https://api.razorpay.com/v1${path}`, {
    method: options.method,
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  const data = await response.json()

  if (!response.ok) {
    const errorDesc = data?.error?.description || data?.error?.reason || 'Unknown Razorpay error'
    throw new Error(`Razorpay API error (${response.status}): ${errorDesc}`)
  }

  return data
}

// ═══════════════════════════════════════════════════════════════════
// CREATE ORDER
// ═══════════════════════════════════════════════════════════════════

export async function createOrder(params: {
  campaignId: string
  milestoneId?: string
  brandId: string
  currency: string
  paymentType: 'escrow' | 'milestone' | 'direct'
  amount: number // smallest currency unit (paise/cents)
}): Promise<{
  orderId: string
  razorpayOrderId: string
  amount: number
  currency: string
  keyId: string
  platformFee: number
  influencerAmount: number
  feePercent: number
  status: string
}> {
  const { campaignId, milestoneId, brandId, currency, paymentType, amount } = params

  // Validate campaign exists and brand owns it
  const campaign = await getCampaignById(campaignId)
  if (!campaign) throw new Error('Campaign not found')
  if (campaign.brandId !== brandId) throw new Error('Not authorized')

  // ── Duplicate + granularity guards ──────────────────────────────
  //
  // The duplicate check used to live entirely inside `if (milestoneId)`, so
  // CAMPAIGN-LEVEL orders had no duplicate protection at all — a brand could
  // pay the full budget twice. Phase 0 hid the button; this is the actual
  // refusal, and it is the one that holds against a direct API call.
  //
  // 'pending' is deliberately NOT blocking: a row in that state is an
  // abandoned checkout where no money moved, and a brand must be able to
  // retry it.
  const existingPayments = await getPaymentsByCampaign(campaignId)
  const BLOCKING_STATUSES = new Set(['escrowed', 'released'])
  const held = existingPayments.filter((p) => BLOCKING_STATUSES.has(p.status))
  const heldCampaignLevel = held.find((p) => !p.milestoneId)
  const heldMilestoneLevel = held.find((p) => p.milestoneId)

  const blockDuplicate = async (message: string) => {
    await logDataAccess({
      userId: brandId,
      action: 'write',
      dataType: 'events',
      accessedBy: brandId,
      reason: 'Duplicate payment attempt blocked',
      metadata: { campaignId, milestoneId: milestoneId ?? null, error: 'DuplicatePaymentError' },
    })
    throw new DuplicatePaymentError(message)
  }

  if (milestoneId) {
    // v1 forbids mixing the two models on one campaign. Releasing part of a
    // campaign-level escrow against a milestone needs partial-release support
    // (a released_amount column or child rows) that does not exist — so this
    // refuses loudly rather than half-working and stranding the difference.
    if (heldCampaignLevel) {
      throw new MixedPaymentGranularityError(
        'This campaign already has a campaign-level payment, so milestone payments cannot be added to it. ' +
        'Refund the campaign-level payment first, or keep paying at the campaign level.'
      )
    }
    const dup = held.find((p) => p.milestoneId === milestoneId)
    if (dup) {
      await blockDuplicate(
        `Payment already exists for milestone ${milestoneId} (status: ${dup.status})`
      )
    }
  } else {
    if (heldMilestoneLevel) {
      throw new MixedPaymentGranularityError(
        'This campaign already has milestone payments, so it cannot also take a campaign-level payment. ' +
        'Pay the remaining milestones individually.'
      )
    }
    if (heldCampaignLevel) {
      await blockDuplicate(
        `Payment already exists for campaign ${campaignId} (status: ${heldCampaignLevel.status})`
      )
    }
  }

  if (amount <= 0) throw new Error('Amount must be greater than 0')

  // Calculate platform fee
  const { platformFee, influencerAmount, feePercent } = calculatePlatformFee(amount, paymentType)

  // Create Razorpay order via API
  let razorpayResponse: any
  try {
    razorpayResponse = await razorpayFetch('/orders', {
      method: 'POST',
      body: {
        amount,
        currency,
        receipt: milestoneId ?? campaignId,
        notes: {
          campaignId,
          milestoneId: milestoneId ?? '',
          brandId,
          platformFee: platformFee.toString(),
        },
      },
    })
  } catch (error) {
    await logDataAccess({
      userId: brandId,
      action: 'write',
      dataType: 'events',
      accessedBy: brandId,
      reason: 'Razorpay order creation failed',
      metadata: {
        campaignId,
        amount,
        currency,
        error: error instanceof Error ? error.message : 'Unknown',
      },
    })
    throw error
  }

  const razorpayOrderId = razorpayResponse.id as string

  // Save order record
  const order = await createOrderRecord({
    campaignId,
    milestoneId: milestoneId ?? null,
    brandId,
    razorpayOrderId,
    amount,
    currency,
    platformFee,
    influencerAmount,
    status: 'created',
    international: currency !== 'INR',
  })

  // ── THE LEDGER ROW ──────────────────────────────────────────────
  //
  // Written HERE, at order creation, as 'pending' — not at capture. Two
  // reasons, and the second is the important one:
  //
  //   1. `paymentType` is in hand now; `razorpay_orders` does not store it,
  //      so a capture-time write would need a new column to stay faithful.
  //   2. It makes the webhook's `status === 'pending'` guard CORRECT. That
  //      guard already existed and was dead code — nothing ever created a
  //      'pending' row — so capture and the webhook both silently no-op'd.
  //      Turning existing dead code into the idempotency mechanism beats
  //      adding new machinery beside it.
  //
  // ⚠️ NOT wrapped in try/catch, deliberately. If this insert fails the whole
  // call must fail, so no checkout ever opens for an order the ledger does
  // not know about. At this point no money has moved, so failing loudly here
  // is free — which is exactly the property the old code lacked.
  //
  // ⚠️ influencerAmount is set EXPLICITLY. `process-payouts` pays out this
  // column, and the deleted escrowForMilestone never set it — a row it wrote
  // would have produced a NULL payout. Fee fields all come from the single
  // calculatePlatformFee() call above, so the ledger, the Razorpay order and
  // the payout all agree by construction rather than by three matching
  // calculations.
  await createPayment({
    campaignId,
    milestoneId: milestoneId ?? null,
    amount,
    currency,
    paymentType,
    status: 'pending',
    razorpayOrderId,
    platformFee,
    platformFeePercent: String(feePercent),
    influencerAmount,
    international: currency !== 'INR',
  })

  // Audit log (no sensitive details)
  await logDataAccess({
    userId: brandId,
    action: 'write',
    dataType: 'events',
    accessedBy: brandId,
    reason: 'Razorpay order created',
    metadata: {
      orderId: order.id,
      razorpayOrderId,
      campaignId,
      milestoneId: milestoneId ?? null,
      amount,
      currency,
      platformFee,
      feePercent,
    },
  })

  // Emit payment order created event (non-fatal)
  await emit(PLATFORM_EVENTS.PAYMENT_ORDER_CREATED, {
    actorId: brandId,
    actorRole: 'brand',
    campaignId,
    amount,
    currency,
  }).catch(() => {})

  const { keyId } = getRazorpayCredentials()

  return {
    orderId: order.id,
    razorpayOrderId,
    amount,
    currency,
    keyId,
    platformFee,
    influencerAmount,
    feePercent,
    status: 'created',
  }
}

// ═══════════════════════════════════════════════════════════════════
// VERIFY PAYMENT SIGNATURE
// Uses crypto.createHmac — NEVER the Razorpay SDK.
// ═══════════════════════════════════════════════════════════════════

export function verifyPayment(params: {
  razorpayOrderId: string
  razorpayPaymentId: string
  razorpaySignature: string
}): boolean {
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = params
  const { keySecret } = getRazorpayCredentials()

  const expectedSignature = createHmac('sha256', keySecret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest('hex')

  // Constant-time comparison — timingSafeEqual handles length-mismatch safely
  const expected = Buffer.from(expectedSignature, 'utf8')
  const received = Buffer.from(razorpaySignature, 'utf8')
  if (expected.length !== received.length) return false
  return timingSafeEqual(expected, received)
}

// ═══════════════════════════════════════════════════════════════════
// CAPTURE PAYMENT
// Called after successful verification to capture authorized payment.
// Updates both razorpay_orders and campaign_payments.
// ═══════════════════════════════════════════════════════════════════

export async function capturePayment(params: {
  razorpayOrderId: string
  razorpayPaymentId: string
  razorpaySignature: string
  brandId: string
}): Promise<{ orderId: string; campaignPaymentId?: string }> {
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature, brandId } = params

  // Verify signature first
  const isValid = verifyPayment({ razorpayOrderId, razorpayPaymentId, razorpaySignature })
  if (!isValid) {
    await logDataAccess({
      userId: brandId,
      action: 'write',
      dataType: 'events',
      accessedBy: brandId,
      reason: 'Invalid Razorpay payment signature',
      metadata: { razorpayOrderId, razorpayPaymentId },
    })
    throw new PaymentVerificationError('Invalid payment signature')
  }

  // Get order record
  const order = await getOrderByRazorpayId(razorpayOrderId)
  if (!order) throw new Error(`Order not found: ${razorpayOrderId}`)
  if (order.brandId !== brandId) throw new Error('Not authorized')

  // Idempotency: if already paid, return success
  if (order.status === 'paid') {
    return { orderId: order.id }
  }

  // Update razorpay order to paid
  await updateOrderStatus(razorpayOrderId, {
    status: 'paid',
    razorpayPaymentId,
    razorpaySignature,
  })

  // ── Move the ledger row to 'escrowed' ───────────────────────────
  //
  // Keyed on the ORDER, not the milestone. The old lookup went via
  // getPaymentByMilestone inside `if (order.milestoneId)`, so a
  // campaign-level payment (milestone_id NULL) was invisible here and the
  // ledger was never written — the gap confirmed on a real payment.
  //
  // The claim is conditional (WHERE status='pending'). This path and the
  // Razorpay webhook are BOTH meant to fire and race by design; the database
  // arbitrates, so whichever arrives second gets null and does nothing. A
  // null here is the normal, correct outcome of losing that race — not an
  // error, and deliberately not logged as one.
  let campaignPaymentId: string | undefined
  const ledgerRow = await getPaymentByRazorpayOrderId(order.razorpayOrderId)
  if (ledgerRow) {
    const claimed = await claimPaymentEscrowed(ledgerRow.id, {
      razorpayOrderId: order.razorpayOrderId,
      razorpayPaymentId,
    })
    campaignPaymentId = (claimed ?? ledgerRow).id
  } else {
    // Pre-Phase-1 order, or an order whose ledger insert predates this code.
    // Worth seeing, since the invariant is "every paid order has exactly one
    // ledger row" — but not worth failing a captured payment over.
    console.warn(
      `[capturePayment] No campaign_payments row for order ${order.razorpayOrderId} — ` +
      'pre-Phase-1 order? Payment captured; ledger not updated.'
    )
  }

  // Audit log
  await logDataAccess({
    userId: brandId,
    action: 'write',
    dataType: 'events',
    accessedBy: brandId,
    reason: 'Payment captured and escrowed',
    metadata: {
      orderId: order.id,
      razorpayOrderId,
      razorpayPaymentId,
      campaignId: order.campaignId,
      milestoneId: order.milestoneId,
      amount: order.amount,
      currency: order.currency,
    },
  })

  // Emit payment escrowed event (non-fatal)
  await emit(PLATFORM_EVENTS.PAYMENT_ESCROWED, {
    actorId: brandId,
    actorRole: 'brand',
    campaignId: order.campaignId,
    amount: order.amount,
    currency: order.currency,
  }).catch(() => {})

  return { orderId: order.id, campaignPaymentId }
}

// ═══════════════════════════════════════════════════════════════════
// REFUND PAYMENT
// Full or partial refund via Razorpay Refunds API.
// ═══════════════════════════════════════════════════════════════════

export async function refundPayment(params: {
  razorpayOrderId: string
  razorpayPaymentId: string
  amount?: number // if omitted → full refund
  reason?: string
  brandId: string
}): Promise<{ refundId: string; amount: number; status: string }> {
  const { razorpayOrderId, razorpayPaymentId, amount, reason, brandId } = params

  let refundResponse: any
  try {
    const body: Record<string, unknown> = {}
    if (amount) body.amount = amount
    if (reason) body.notes = { reason }

    refundResponse = await razorpayFetch(`/payments/${razorpayPaymentId}/refund`, {
      method: 'POST',
      body,
    })
  } catch (error) {
    await logDataAccess({
      userId: brandId,
      action: 'write',
      dataType: 'events',
      accessedBy: brandId,
      reason: 'Razorpay refund failed',
      metadata: {
        razorpayPaymentId,
        amount,
        error: error instanceof Error ? error.message : 'Unknown',
      },
    })
    throw error
  }

  const refundId = refundResponse.id as string
  const refundAmount = refundResponse.amount as number

  // Audit log
  await logDataAccess({
    userId: brandId,
    action: 'write',
    dataType: 'events',
    accessedBy: brandId,
    reason: 'Payment refund processed',
    metadata: {
      razorpayPaymentId,
      refundId,
      refundAmount,
      refundReason: reason ?? 'Not specified',
    },
  })

  // B35: keep campaign_payments in sync (mirror capturePayment, which escrows
  // milestone payments on capture). On a FULL refund, flip the escrowed
  // milestone payment to 'refunded' so the ledger doesn't show money still held
  // after it's been returned. Partial refunds leave status as-is (there is no
  // 'partially_refunded' state). Non-fatal — the Razorpay refund already
  // succeeded, so a bookkeeping miss must not surface as a refund failure.
  try {
    const order = await getOrderByRazorpayId(razorpayOrderId)
    const isFullRefund = amount === undefined || (order ? amount >= order.amount : false)
    // Keyed on the order, not the milestone — a campaign-level refund used to
    // leave its ledger row reading 'escrowed' forever, showing money held that
    // had already gone back.
    if (order && isFullRefund) {
      const payment = await getPaymentByRazorpayOrderId(order.razorpayOrderId)
      if (payment && payment.status !== 'refunded') {
        await updatePaymentStatus(payment.id, 'refunded', { refundedAt: new Date() })
      }
    }
  } catch (err) {
    console.error('[refundPayment] campaign_payments sync failed (refund itself succeeded):', err)
  }

  return {
    refundId,
    amount: refundAmount,
    status: refundResponse.status,
  }
}

// ═══════════════════════════════════════════════════════════════════
// VERIFY WEBHOOK SIGNATURE
// Verifies Razorpay webhook payload signature.
// ═══════════════════════════════════════════════════════════════════

export function verifyWebhookSignature(
  body: string,
  signature: string
): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET
  if (!secret) {
    console.error('[RazorpayService] RAZORPAY_WEBHOOK_SECRET not set')
    return false
  }

  const expectedSignature = createHmac('sha256', secret)
    .update(body)
    .digest('hex')

  // Constant-time comparison — timingSafeEqual handles length-mismatch safely
  const expected = Buffer.from(expectedSignature, 'utf8')
  const received = Buffer.from(signature, 'utf8')
  if (expected.length !== received.length) return false
  return timingSafeEqual(expected, received)
}
