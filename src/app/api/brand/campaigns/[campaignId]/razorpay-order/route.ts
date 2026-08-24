/**
 * GET /api/brand/campaigns/[campaignId]/razorpay-order
 *
 * Returns the latest Razorpay order for a campaign.
 * Used by the payment tab to restore checkout state after page reload.
 *
 * Auth: brand role, owns campaign
 */

import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { getCampaignById } from '@/db/repositories/influencerCampaignRepository'
import { getOrdersByCampaign } from '@/db/repositories/razorpayRepository'

type RouteParams = { params: Promise<{ campaignId: string }> }

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
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

    const campaign = await getCampaignById(campaignId)
    if (!campaign || campaign.brandId !== brandId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const orders = await getOrdersByCampaign(campaignId)
    // Return most recent order (already sorted desc by createdAt in repo)
    const latest = orders[0] ?? null

    // ⚠️ The LATEST order is not enough to answer "has this campaign been
    // paid?". Nothing currently stops a second campaign-level order being
    // created (the duplicate guard in razorpayService.createOrder is inside
    // `if (milestoneId)`), so a paid order followed by a newer 'created' one
    // would leave `latest.status === 'created'` and the payment tab would
    // cheerfully offer checkout again — a second real charge.
    //
    // So report the paid order separately, scanning ALL orders. 'refunded' is
    // deliberately excluded: the money has gone back, so the brand may
    // legitimately pay again.
    const paid = orders.find((o) => o.status === 'paid') ?? null

    const shape = (o: NonNullable<typeof latest>) => ({
      id: o.id,
      razorpayOrderId: o.razorpayOrderId,
      amount: o.amount,
      currency: o.currency,
      platformFee: o.platformFee,
      influencerAmount: o.influencerAmount,
      status: o.status,
      milestoneId: o.milestoneId,
      createdAt: o.createdAt,
    })

    if (!latest) return NextResponse.json({ order: null, paidOrder: null })

    // Never expose signature to client
    return NextResponse.json({
      order: shape(latest),
      paidOrder: paid ? shape(paid) : null,
    })
  } catch (error) {
    console.error('[RazorpayOrder GET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
