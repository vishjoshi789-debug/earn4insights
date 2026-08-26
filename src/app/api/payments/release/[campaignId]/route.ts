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
import { validateCsrfToken, csrfErrorResponse } from '@/lib/csrf'
import { getCampaignById } from '@/db/repositories/influencerCampaignRepository'
import { getInvitation } from '@/db/repositories/campaignInfluencerRepository'
import { getMilestoneById } from '@/db/repositories/campaignMilestoneRepository'
import {
  getPaymentByMilestone,
  getPaymentsByCampaign,
  updatePaymentStatus,
} from '@/db/repositories/campaignPaymentRepository'
import { initiateRecipientPayout, PayoutAccountMissingError } from '@/server/payoutService'
import { emit, PLATFORM_EVENTS } from '@/server/eventBus'

type RouteParams = { params: Promise<{ campaignId: string }> }

export async function POST(req: NextRequest, { params }: RouteParams) {
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

    const { campaignId } = await params

    // ── Parse body ──────────────────────────────────────────────────
    const body = await req.json().catch(() => null)
    if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

    const { milestoneId, influencerId } = body
    // ⚠️ milestoneId is now OPTIONAL. It used to be required, which meant a
    // campaign-level payment (milestone_id NULL) had NO route to the creator
    // at all: money could enter escrow and never leave. Omitting it releases
    // the campaign-level payment.
    if (milestoneId !== undefined && typeof milestoneId !== 'string') {
      return NextResponse.json({ error: 'milestoneId must be a string' }, { status: 400 })
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

    // ── Resolve the payment being released ───────────────────────────
    //
    // Two shapes, deliberately kept apart rather than merged:
    //
    //   milestoneId given  → milestone payment; the APPROVED milestone is the
    //                        authorisation for releasing it.
    //   milestoneId absent → campaign-level payment (milestone_id NULL). There
    //                        is no milestone to approve, so the brand's own
    //                        release call IS the authorisation.
    //
    // The campaign-level branch has a weaker gate by necessity, not oversight:
    // nothing else exists to check. Ownership (above) and 'escrowed' (below)
    // remain the guarantees.
    let milestone: Awaited<ReturnType<typeof getMilestoneById>> | null = null
    let payment

    if (milestoneId) {
      milestone = await getMilestoneById(milestoneId)
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
      payment = await getPaymentByMilestone(milestoneId)
      if (!payment) {
        return NextResponse.json({ error: 'No escrowed payment found for this milestone' }, { status: 404 })
      }
    } else {
      const campaignLevel = (await getPaymentsByCampaign(campaignId))
        .filter((p) => !p.milestoneId)
      if (campaignLevel.length === 0) {
        return NextResponse.json(
          { error: 'No campaign-level payment found. If this campaign pays per milestone, pass milestoneId.' },
          { status: 404 }
        )
      }
      // Phase 1 forbids a campaign holding more than one campaign-level
      // payment (MixedPaymentGranularityError + the duplicate guard), so more
      // than one here means an invariant broke. Refuse rather than guess which
      // one to release.
      if (campaignLevel.length > 1) {
        console.error(
          `[PaymentRelease] ${campaignLevel.length} campaign-level payments on campaign ${campaignId} — expected at most 1`
        )
        return NextResponse.json(
          { error: 'Multiple campaign-level payments found for this campaign. Contact support.' },
          { status: 409 }
        )
      }
      payment = campaignLevel[0]
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
      // Migration 038. Without it this payout is invisible to
      // process-payouts' dedup and the cron would pay the creator a second
      // time on its next tick.
      campaignPaymentId: payment.id,
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
      // Campaign-level releases have no milestone; the event's copy falls back
      // to the campaign itself rather than rendering "undefined" to a creator.
      milestoneName: milestone ? (milestone.title ?? milestone.id) : 'Campaign payment',
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
