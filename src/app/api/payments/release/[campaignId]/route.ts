/**
 * POST /api/payments/release/[campaignId]
 *
 * Brand releases escrowed payment for an approved milestone.
 * Triggers a payout record in the admin manual queue.
 *
 * Body: { milestoneId, influencerId }
 *
 * Auth: brand role, owns campaign
 */

import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { getCampaignById } from '@/db/repositories/influencerCampaignRepository'
import { getInvitation } from '@/db/repositories/campaignInfluencerRepository'
import { getMilestoneById } from '@/db/repositories/campaignMilestoneRepository'
import { getPaymentByMilestone, updatePaymentStatus } from '@/db/repositories/campaignPaymentRepository'
import { initiateRecipientPayout, PayoutAccountMissingError } from '@/server/payoutService'
import { emit, PLATFORM_EVENTS } from '@/server/eventBus'

type RouteParams = { params: Promise<{ campaignId: string }> }

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

    const { campaignId } = await params

    // ── Parse body ──────────────────────────────────────────────────
    const body = await req.json().catch(() => null)
    if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

    const { milestoneId, influencerId } = body
    if (!milestoneId || typeof milestoneId !== 'string') {
      return NextResponse.json({ error: 'milestoneId is required' }, { status: 400 })
    }
    if (!influencerId || typeof influencerId !== 'string') {
      return NextResponse.json({ error: 'influencerId is required' }, { status: 400 })
    }

    // ── Validate campaign ownership ──────────────────────────────────
    const campaign = await getCampaignById(campaignId)
    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }
    if (campaign.brandId !== brandId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    // ── Validate influencer is assigned to this campaign ─────────────
    const invitation = await getInvitation(campaignId, influencerId)
    if (!invitation || !['accepted', 'active', 'completed'].includes(invitation.status)) {
      return NextResponse.json(
        { error: 'Influencer is not assigned to this campaign' },
        { status: 400 }
      )
    }

    // ── Validate milestone is approved ───────────────────────────────
    const milestone = await getMilestoneById(milestoneId)
    if (!milestone) {
      return NextResponse.json({ error: 'Milestone not found' }, { status: 404 })
    }
    if (milestone.campaignId !== campaignId) {
      return NextResponse.json({ error: 'Milestone does not belong to this campaign' }, { status: 400 })
    }
    if (milestone.status !== 'approved') {
      return NextResponse.json(
        { error: 'Milestone must be approved before payment can be released' },
        { status: 400 }
      )
    }

    // ── Validate escrowed payment exists ─────────────────────────────
    const payment = await getPaymentByMilestone(milestoneId)
    if (!payment) {
      return NextResponse.json({ error: 'No escrowed payment found for this milestone' }, { status: 404 })
    }
    if (payment.status !== 'escrowed') {
      return NextResponse.json(
        { error: `Payment is already ${payment.status}` },
        { status: 400 }
      )
    }

    // ── Update payment to released ───────────────────────────────────
    await updatePaymentStatus(payment.id, 'released', { releasedAt: new Date() })

    // ── Create payout record in admin queue ──────────────────────────
    const influencerAmount = payment.influencerAmount ?? (payment.amount - payment.platformFee)
    const payout = await initiateRecipientPayout({
      campaignId,
      recipientId: influencerId,
      recipientType: 'influencer',
      amount: influencerAmount,
      currency: payment.currency,
    })

    // Emit payment released event (non-fatal)
    await emit(PLATFORM_EVENTS.PAYMENT_RELEASED, {
      actorId: brandId,
      actorRole: 'brand',
      campaignId,
      influencerId,
      amount: influencerAmount,
      currency: payment.currency,
      milestoneName: milestone.title ?? milestone.id,
    }).catch(() => {})

    return NextResponse.json({
      success: true,
      payoutId: payout.payoutId,
      method: payout.method,
      status: payout.status,
      amount: influencerAmount,
      currency: payment.currency,
    })
  } catch (error) {
    if (error instanceof PayoutAccountMissingError) {
      return NextResponse.json(
        { error: 'Influencer has not set up a payout account yet' },
        { status: 422 }
      )
    }
    console.error('[PaymentRelease POST]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
