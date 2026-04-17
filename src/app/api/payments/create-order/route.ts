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
import { checkRateLimit, getRateLimitKey, RATE_LIMITS } from '@/lib/rate-limit'
import { createOrder } from '@/server/razorpayService'
import { getCampaignById } from '@/db/repositories/influencerCampaignRepository'
import { getMilestoneById } from '@/db/repositories/campaignMilestoneRepository'
import { DuplicatePaymentError } from '@/server/razorpayService'

export async function POST(req: NextRequest) {
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

    // ── Rate limit ──────────────────────────────────────────────────
    const rl = checkRateLimit(getRateLimitKey(req, 'payment-create-order'), RATE_LIMITS.paymentCreateOrder)
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait before trying again.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
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
    console.error('[CreateOrder POST]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
