/**
 * Fire a correctly-signed Razorpay webhook at our endpoint.
 *
 * Uses only Node built-ins (crypto, global fetch) — no npm install needed.
 *
 * Usage:
 *   node fire-webhook.mjs <baseUrl> <razorpay_order_id> [event] [razorpay_payment_id]
 *
 * Example (preview):
 *   $env:RAZORPAY_WEBHOOK_SECRET = '<preview value>'
 *   node fire-webhook.mjs https://earn4insights-git-preview-env-joshis-projects-51800fce.vercel.app order_TTcZjEb8m4UtFS
 *
 * Requires RAZORPAY_WEBHOOK_SECRET in the environment — and it must be the
 * value set on the TARGET deployment, not production's. Razorpay test mode and
 * live mode have SEPARATE webhook configs and SEPARATE secrets, and Vercel env
 * vars default to "All Environments", so a Preview deployment can easily be
 * holding the live webhook's secret.
 *
 * ⚠️ The endpoint ALWAYS returns 200, including on signature failure (it must
 * not reveal validation outcomes to callers). So a 200 here proves DELIVERY,
 * NOT that the signature verified or that anything was written. Confirm the
 * effect in the database, never from the HTTP status:
 *
 *   -- did the signature verify?
 *   SELECT created_at, reason FROM audit_log
 *   WHERE reason LIKE '%Razorpay webhook%' ORDER BY created_at DESC LIMIT 10;
 *     'Invalid Razorpay webhook signature rejected' -> secret mismatch
 *     'Razorpay webhook received: payment.captured' -> verified, handler ran
 *
 *   -- did the ledger move?
 *   SELECT status, milestone_id, amount, influencer_amount, escrowed_at, updated_at
 *   FROM campaign_payments WHERE razorpay_order_id = '<order id>';
 *
 * ⚠️ On a REPLAY against an already-escrowed order, campaign_payments must NOT
 * change (the conditional claim refuses the second write) — but
 * razorpay_orders.updated_at WILL bump, because updateOrderStatus runs
 * unconditionally. That is expected and is not a failure.
 */
import { createHmac } from 'node:crypto'

const [, , baseUrl, orderId, event = 'payment.captured', paymentId] = process.argv

if (!baseUrl || !orderId) {
  console.error('usage: node fire-webhook.mjs <baseUrl> <razorpay_order_id> [event] [payment_id]')
  process.exit(1)
}

const secret = process.env.RAZORPAY_WEBHOOK_SECRET
if (!secret) {
  console.error('RAZORPAY_WEBHOOK_SECRET is not set in this shell.')
  process.exit(1)
}

// Shape mirrors what the route actually reads:
//   event, payload.payment.entity.{order_id, id, method}
const body = JSON.stringify({
  event,
  payload: {
    payment: {
      entity: {
        order_id: orderId,
        id: paymentId ?? `pay_SIMULATED${Date.now()}`,
        method: 'upi',
        ...(event === 'payment.failed'
          ? { error_description: 'Simulated failure (webhook test)' }
          : {}),
      },
    },
  },
})

// ⚠️ Sign the EXACT bytes that get sent. The route verifies against
// `await req.text()`, so re-serialising anywhere between here and the wire
// would invalidate the signature.
const signature = createHmac('sha256', secret).update(body).digest('hex')

const url = `${baseUrl.replace(/\/$/, '')}/api/webhooks/razorpay`
console.log(`POST ${url}`)
console.log(`event=${event}  order=${orderId}`)
console.log(`body bytes=${Buffer.byteLength(body)}  signature=${signature.slice(0, 16)}…`)

const res = await fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-razorpay-signature': signature,
  },
  body,
})

console.log(`\nHTTP ${res.status}  ${await res.text()}`)
console.log(
  '\n⚠️ 200 means DELIVERED, not VERIFIED. A wrong secret also returns 200 and is\n' +
  '   silently discarded. Check audit_log and campaign_payments to see what happened.'
)
