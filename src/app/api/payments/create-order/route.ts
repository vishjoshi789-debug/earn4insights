/**
 * POST /api/payments/create-order
 *
 * Brand creates a Razorpay payment order for a campaign or milestone.
 * Returns orderId + amount + keyId for the Razorpay frontend checkout.
 *
 * Auth: brand role only
 * Rate limit: 10 requests/minute per IP
 */

import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { paymentCreateOrderRateLimit } from '@/lib/rate-limit-upstash'
import { validateCsrfToken, csrfErrorResponse } from '@/lib/csrf'
import { createOrder } from '@/server/razorpayService'
import { getCampaignById } from '@/db/repositories/influencerCampaignRepository'
import { getMilestoneById } from '@/db/repositories/campaignMilestoneRepository'
import { DuplicatePaymentError, MixedPaymentGranularityError } from '@/server/razorpayService'
import {
  requireEmailVerified,
  EmailNotVerifiedError,
  emailNotVerifiedResponseBody,
} from '@/server/emailVerificationGuard'
import { arePaymentsEnabled, PAYMENTS_DISABLED_MESSAGE } from '@/lib/payments/paymentsEnabled'

export async function POST(req: NextRequest) {
  if (!validateCsrfToken(req)) return csrfErrorResponse()
  try {
    // ── PAYMENT GATE — before auth, before anything ─────────────────
    // The standing rule is that no brand pays until the campaign_payments
    // ledger gap is fixed and rehearsed. That rule used to live only in a
    // document; this makes it a control.
    //
    // Deliberately the FIRST check: this is the single entry point for
    // creating a Razorpay order, so refusing here means no order can exist,
    // which means no checkout can be opened and no card can be charged.
    //
    // ⚠️ Only order CREATION is gated. `/api/payments/verify` and the
    // Razorpay webhook are intentionally NOT gated — if an order was created
    // before the switch was flipped and the brand has already paid, blocking
    // verification would take their money and record nothing, which is worse
    // than the problem being prevented. In-flight payments must complete.
    if (!arePaymentsEnabled()) {
      console.warn('[CreateOrder] Blocked — PAYMENTS_ENABLED is not "true"')
      return NextResponse.json(
        { error: PAYMENTS_DISABLED_MESSAGE, code: 'payments_disabled' },
        { status: 503 }
      )
    }

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

    // EV.1 hard-block — creating a Razorpay order is a financial action.
    try {
      await requireEmailVerified(brandId)
    } catch (err) {
      if (err instanceof EmailNotVerifiedError) {
        return NextResponse.json(emailNotVerifiedResponseBody(), { status: 403 })
      }
      throw err
    }

    // ── Rate limit (10 / min per brand, distributed via Upstash) ────
    const rl = await paymentCreateOrderRateLimit.limit(brandId)
    if (!rl.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait before trying again.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.reset - Date.now()) / 1000)) } }
      )
    }

    // ── Parse body ──────────────────────────────────────────────────
    const body = await req.json().catch(() => null)
    if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

    const { campaignId, milestoneId, currency, paymentType } = body

    if (!campaignId || typeof campaignId !== 'string') {
      return NextResponse.json({ error: 'campaignId is required' }, { status: 400 })
    }
    if (!currency || typeof currency !== 'string') {
      return NextResponse.json({ error: 'currency is required' }, { status: 400 })
    }
    if (!paymentType || !['escrow', 'milestone', 'direct'].includes(paymentType)) {
      return NextResponse.json({ error: 'paymentType must be escrow, milestone, or direct' }, { status: 400 })
    }

    // ── Validate campaign ────────────────────────────────────────────
    const campaign = await getCampaignById(campaignId)
    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }
    if (campaign.brandId !== brandId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }
    if (campaign.status !== 'active') {
      return NextResponse.json({ error: 'Campaign must be active to accept payments' }, { status: 400 })
    }

    // ── Validate milestone (if provided) ────────────────────────────
    let amount = campaign.budgetTotal
    if (milestoneId) {
      if (typeof milestoneId !== 'string') {
        return NextResponse.json({ error: 'milestoneId must be a string' }, { status: 400 })
      }
      const milestone = await getMilestoneById(milestoneId)
      if (!milestone) {
        return NextResponse.json({ error: 'Milestone not found' }, { status: 404 })
      }
      if (milestone.campaignId !== campaignId) {
        return NextResponse.json({ error: 'Milestone does not belong to this campaign' }, { status: 400 })
      }
      amount = milestone.paymentAmount
    }

    // ── Create order ────────────────────────────────────────────────
    const result = await createOrder({
      campaignId,
      milestoneId: milestoneId ?? undefined,
      brandId,
      currency,
      paymentType,
      amount,
    })

    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof DuplicatePaymentError) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    // 400, not 409: nothing is duplicated — the campaign is being paid at the
    // wrong granularity. The message names the fix, because a bare "invalid
    // request" would leave a brand with no way to work out what to do.
    if (error instanceof MixedPaymentGranularityError) {
      return NextResponse.json(
        { error: error.message, code: 'mixed_payment_granularity' },
        { status: 400 }
      )
    }
    console.error('[CreateOrder POST]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
