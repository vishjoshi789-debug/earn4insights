/**
 * POST /api/webhooks/razorpay
 *
 * Receives and processes Razorpay webhook events.
 *
 * Security:
 *   - No auth middleware (public endpoint)
 *   - All requests validated via HMAC-SHA256 signature
 *   - Always returns 200 (never reveal signature failures to Razorpay)
 *   - Processing happens async after response is sent
 *
 * Handled events:
 *   payment.captured   → mark order paid, update campaign_payments to escrowed
 *   payment.failed     → mark order failed, log failure reason
 *   payout.processed   → mark payout completed
 *   payout.failed      → mark payout failed, log reason
 *   refund.created     → update refund fields on order
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyWebhookSignature } from '@/server/razorpayService'
import { updateOrderStatus, getOrderByRazorpayId, updatePayoutStatus } from '@/db/repositories/razorpayRepository'
import {
  updatePaymentStatus,
  getPaymentByRazorpayOrderId,
  claimPaymentEscrowed,
} from '@/db/repositories/campaignPaymentRepository'
import { logDataAccess } from '@/lib/audit-log'

// NOTE: No 'server-only' import — this route must be importable by Next.js edge runtime.
// Webhook routes must NOT import any server-only modules at the top level.

export async function POST(req: NextRequest) {
  // ── Read body + signature ─────────────────────────────────────────
  const rawBody = await req.text()
  const signature = req.headers.get('x-razorpay-signature') ?? ''

  // Always return 200 — never reveal signature validation outcome.
  // Process synchronously before returning so Vercel serverless doesn't
  // kill the function before DB writes complete (fire-and-forget is unsafe).
  await processWebhookAsync(rawBody, signature).catch((err) => {
    console.error('[RazorpayWebhook] Processing error:', err)
  })

  return NextResponse.json({ received: true }, { status: 200 })
}

async function processWebhookAsync(rawBody: string, signature: string): Promise<void> {
  // ── Signature verification ────────────────────────────────────────
  const isValid = verifyWebhookSignature(rawBody, signature)
  if (!isValid) {
    await logDataAccess({
      userId: 'system',
      action: 'write',
      dataType: 'events',
      accessedBy: 'system',
      reason: 'Invalid Razorpay webhook signature rejected',
      metadata: { signaturePresent: !!signature },
    })
    return // Silently discard — already sent 200
  }

  let event: any
  try {
    event = JSON.parse(rawBody)
  } catch {
    console.error('[RazorpayWebhook] Failed to parse webhook body')
    return
  }

  const eventType: string = event?.event ?? 'unknown'
  const payload = event?.payload ?? {}

  await logDataAccess({
    userId: 'system',
    action: 'write',
    dataType: 'events',
    accessedBy: 'system',
    reason: `Razorpay webhook received: ${eventType}`,
    metadata: { eventType, payloadKeys: Object.keys(payload) },
  })

  try {
    switch (eventType) {
      case 'payment.captured': {
        const payment = payload?.payment?.entity
        if (!payment) break
        const razorpayOrderId: string = payment.order_id
        const razorpayPaymentId: string = payment.id
        const paymentMethod: string = payment.method ?? 'unknown'

        await updateOrderStatus(razorpayOrderId, {
          status: 'paid',
          razorpayPaymentId,
          paymentMethod,
        })

        // ── Move the ledger row to 'escrowed' ──────────────────────
        //
        // Keyed on the ORDER. This used to look up via the milestone inside
        // `if (order?.milestoneId)`, so campaign-level payments never reached
        // the ledger. It also checked `status === 'pending'` — a state nothing
        // created until Phase 1 — so this branch was dead twice over.
        //
        // Now it is the safety net for the capture path: if the brand closes
        // the tab before returning from checkout, this is the only thing that
        // records the money. The claim is conditional, so when both fire the
        // loser simply gets null.
        const order = await getOrderByRazorpayId(razorpayOrderId)
        if (order) {
          const ledgerRow = await getPaymentByRazorpayOrderId(order.razorpayOrderId)
          if (ledgerRow) {
            await claimPaymentEscrowed(ledgerRow.id, { razorpayOrderId, razorpayPaymentId })
          }
        }
        break
      }

      case 'payment.failed': {
        const payment = payload?.payment?.entity
        if (!payment) break
        const razorpayOrderId: string = payment.order_id
        const failureReason: string =
          payment.error_description ?? payment.error_reason ?? 'Unknown failure'

        await updateOrderStatus(razorpayOrderId, { status: 'failed' })

        // Mark the linked ledger row failed too — order-keyed, same reason as
        // payment.captured. Still guarded on 'pending': a row that already
        // reached 'escrowed' has money behind it and must not be downgraded
        // by a late or out-of-order failure event.
        const order = await getOrderByRazorpayId(razorpayOrderId)
        if (order) {
          const ledgerRow = await getPaymentByRazorpayOrderId(order.razorpayOrderId)
          if (ledgerRow && ledgerRow.status === 'pending') {
            await updatePaymentStatus(ledgerRow.id, 'failed', { failureReason })
          }
        }

        await logDataAccess({
          userId: 'system',
          action: 'write',
          dataType: 'events',
          accessedBy: 'system',
          reason: 'Payment failed webhook',
          metadata: { razorpayOrderId, failureReason },
        })
        break
      }

      case 'payout.processed': {
        const payout = payload?.payout?.entity
        if (!payout) break
        // razorpay_payout_id is stored on our influencer_payouts record
        const razorpayPayoutId: string = payout.id
        // Find our payout record by razorpay_payout_id
        // Note: updatePayoutStatus takes our internal UUID, not razorpay payout id
        // We rely on status sync cron for now — log the event
        await logDataAccess({
          userId: 'system',
          action: 'write',
          dataType: 'events',
          accessedBy: 'system',
          reason: 'Razorpay payout processed webhook',
          metadata: { razorpayPayoutId, status: payout.status },
        })
        break
      }

      case 'payout.failed': {
        const payout = payload?.payout?.entity
        if (!payout) break
        const razorpayPayoutId: string = payout.id
        const failureReason: string = payout.failure_reason ?? 'Unknown failure'
        await logDataAccess({
          userId: 'system',
          action: 'write',
          dataType: 'events',
          accessedBy: 'system',
          reason: 'Razorpay payout failed webhook',
          metadata: { razorpayPayoutId, failureReason },
        })
        break
      }

      case 'refund.created': {
        const refund = payload?.refund?.entity
        if (!refund) break
        // Razorpay refund entity has payment_id, not order_id directly.
        // Look up order via the payment_id on our records.
        const refundPaymentId: string = refund.payment_id ?? ''
        if (refundPaymentId) {
          // Find the order that has this payment ID
          const orderForRefund = await (async () => {
            // Search all orders for this payment ID
            const { eq } = await import('drizzle-orm')
            const { db: dbInner } = await import('@/db')
            const { razorpayOrders } = await import('@/db/schema')
            const rows = await dbInner
              .select()
              .from(razorpayOrders)
              .where(eq(razorpayOrders.razorpayPaymentId, refundPaymentId))
              .limit(1)
            return rows[0] ?? null
          })()
          if (orderForRefund) {
            await updateOrderStatus(orderForRefund.razorpayOrderId, {
              status: 'refunded',
              refundId: refund.id,
              refundAmount: refund.amount,
              refundedAt: new Date(),
            })
          }
        }
        break
      }

      default:
        // Unknown event type — log and ignore
        await logDataAccess({
          userId: 'system',
          action: 'write',
          dataType: 'events',
          accessedBy: 'system',
          reason: `Unhandled Razorpay webhook event: ${eventType}`,
          metadata: { eventType },
        })
    }
  } catch (err) {
    console.error(`[RazorpayWebhook] Error processing event ${eventType}:`, err)
    await logDataAccess({
      userId: 'system',
      action: 'write',
      dataType: 'events',
      accessedBy: 'system',
      reason: `Webhook processing error for ${eventType}`,
      metadata: { eventType, error: err instanceof Error ? err.message : 'Unknown' },
    })
  }
}
