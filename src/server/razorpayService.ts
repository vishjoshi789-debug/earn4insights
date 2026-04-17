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
  updatePaymentStatus,
  getPaymentByMilestone,
  getPaymentsByCampaign,
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

  // Check for duplicate: already-paid order for this campaign/milestone
  if (milestoneId) {
    const existingPayment = await getPaymentByMilestone(milestoneId)
    if (existingPayment && (existingPayment.status === 'escrowed' || existingPayment.status === 'released')) {
      await logDataAccess({
        userId: brandId,
        action: 'write',
        dataType: 'events',
        accessedBy: brandId,
        reason: 'Duplicate payment attempt blocked',
        metadata: { campaignId, milestoneId, error: 'DuplicatePaymentError' },
      })
      throw new DuplicatePaymentError(
        `Payment already exists for milestone ${milestoneId} (status: ${existingPayment.status})`
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

  // Update or create campaign_payments record to escrowed
  let campaignPaymentId: string | undefined
  if (order.milestoneId) {
    const existingPayment = await getPaymentByMilestone(order.milestoneId)
    if (existingPayment) {
      const updated = await updatePaymentStatus(existingPayment.id, 'escrowed', {
        razorpayOrderId: order.razorpayOrderId,
        razorpayPaymentId,
        escrowedAt: new Date(),
      })
      campaignPaymentId = updated.id
    }
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
  razorpayPaymentId: string
  amount?: number // if omitted → full refund
  reason?: string
  brandId: string
}): Promise<{ refundId: string; amount: number; status: string }> {
  const { razorpayPaymentId, amount, reason, brandId } = params

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
