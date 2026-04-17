/**
 * POST /api/payments/refund/[orderId]
 *
 * Brand requests a full or partial refund for a Razorpay payment.
 *
 * Body: { amount?: number, reason?: string }
 * Omit amount for full refund.
 *
 * Auth: brand role, owns campaign
 */

import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { getOrderByRazorpayId } from '@/db/repositories/razorpayRepository'
import { updateOrderStatus } from '@/db/repositories/razorpayRepository'
import { refundPayment } from '@/server/razorpayService'

type RouteParams = { params: Promise<{ orderId: string }> }

export async function POST(req: NextRequest, { params }: RouteParams) {
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

    const { orderId: razorpayOrderId } = await params

    // ── Parse body ──────────────────────────────────────────────────
    const body = await req.json().catch(() => ({}))
    const { amount, reason } = body

    if (amount !== undefined && (typeof amount !== 'number' || amount <= 0)) {
      return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 })
    }

    // ── Validate order ownership ─────────────────────────────────────
    const order = await getOrderByRazorpayId(razorpayOrderId)
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }
    if (order.brandId !== brandId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }
    if (order.status !== 'paid') {
      return NextResponse.json(
        { error: order.status === 'refunded'
          ? 'Order has already been refunded'
          : 'Only paid orders can be refunded (payment may have been released to influencer)' },
        { status: 400 }
      )
    }

    // ── Block refund if payment has been released from escrow ────────
    if (order.milestoneId) {
      const { getPaymentByMilestone: getMilestonePayment } = await import('@/db/repositories/campaignPaymentRepository')
      const payment = await getMilestonePayment(order.milestoneId)
      if (payment && payment.status === 'released') {
        return NextResponse.json(
          { error: 'Cannot refund — payment has already been released to the influencer' },
          { status: 400 }
        )
      }
    }
    if (order.razorpayPaymentId === null) {
      return NextResponse.json({ error: 'No payment ID on order' }, { status: 400 })
    }

    // ── Validate refund amount ───────────────────────────────────────
    if (amount !== undefined && amount > order.amount) {
      return NextResponse.json(
        { error: 'Refund amount cannot exceed original payment amount' },
        { status: 400 }
      )
    }

    // ── Process refund ───────────────────────────────────────────────
    const refundResult = await refundPayment({
      razorpayPaymentId: order.razorpayPaymentId,
      amount,
      reason,
      brandId,
    })

    // ── Update order record ──────────────────────────────────────────
    await updateOrderStatus(razorpayOrderId, {
      status: 'refunded',
      refundAmount: refundResult.amount,
      refundId: refundResult.refundId,
      refundedAt: new Date(),
    })

    return NextResponse.json({
      success: true,
      refundId: refundResult.refundId,
      amount: refundResult.amount,
      status: refundResult.status,
    })
  } catch (error) {
    console.error('[PaymentRefund POST]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
