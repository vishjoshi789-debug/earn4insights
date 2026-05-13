/**
 * POST /api/payments/verify
 *
 * Verify Razorpay payment signature after checkout completion.
 * Captures the payment and marks campaign_payments as escrowed.
 *
 * Idempotent: DuplicatePaymentError returns 200 success.
 *
 * Auth: brand role only
 * Rate limit: 20 requests/minute per IP
 */

import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { paymentVerifyRateLimit } from '@/lib/rate-limit-upstash'
import { validateCsrfToken, csrfErrorResponse } from '@/lib/csrf'
import { capturePayment, PaymentVerificationError, DuplicatePaymentError } from '@/server/razorpayService'
import { getOrderByRazorpayId } from '@/db/repositories/razorpayRepository'

export async function POST(req: NextRequest) {
  if (!validateCsrfToken(req)) return csrfErrorResponse()
  try {
    // ── Auth ────────────────────────────────────────────────────────
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const user = session.user as any
    if (user.role !== 'brand') {
      return NextResponse.json({ error: 'Brand access only' }, { status: 403 })
    }
    const brandId: string = user.id

    // ── Rate limit (20 / min per brand, distributed via Upstash) ────
    const rl = await paymentVerifyRateLimit.limit(brandId)
    if (!rl.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait before trying again.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.reset - Date.now()) / 1000)) } }
      )
    }

    // ── Parse body ──────────────────────────────────────────────────
    const body = await req.json().catch(() => null)
    if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = body

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return NextResponse.json(
        { error: 'razorpayOrderId, razorpayPaymentId, and razorpaySignature are required' },
        { status: 400 }
      )
    }

    // ── Idempotency check ────────────────────────────────────────────
    // If order already paid, return success without re-processing
    const existingOrder = await getOrderByRazorpayId(razorpayOrderId)
    if (existingOrder?.status === 'paid') {
      // Verify the requesting brand actually owns this order
      if (existingOrder.brandId !== brandId) {
        return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
      }
      return NextResponse.json({ success: true, alreadyVerified: true })
    }

    // ── Capture payment ─────────────────────────────────────────────
    const result = await capturePayment({
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      brandId,
    })

    // ── Emit real-time event ────────────────────────────────────────
    // Note: Payment verification is a brand action (escrowing funds).
    // INFLUENCER_CAMPAIGN_ACCEPTED is emitted when the influencer accepts,
    // not when payment is captured. Use milestone completion event if the
    // campaign has milestones, otherwise just log — no misleading events.
    // TODO: Add PAYMENT_ESCROWED event to eventBus when real-time payment
    // notifications are needed.

    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    if (error instanceof PaymentVerificationError) {
      return NextResponse.json({ error: 'Payment verification failed' }, { status: 400 })
    }
    if (error instanceof DuplicatePaymentError) {
      // Idempotent — treat duplicate as success
      return NextResponse.json({ success: true, alreadyVerified: true })
    }
    console.error('[PaymentVerify POST]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
