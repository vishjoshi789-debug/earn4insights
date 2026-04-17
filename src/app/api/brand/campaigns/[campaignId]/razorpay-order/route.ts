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

    if (!latest) return NextResponse.json({ order: null })

    // Never expose signature to client
    return NextResponse.json({
      order: {
        id: latest.id,
        razorpayOrderId: latest.razorpayOrderId,
        amount: latest.amount,
        currency: latest.currency,
        platformFee: latest.platformFee,
        influencerAmount: latest.influencerAmount,
        status: latest.status,
        milestoneId: latest.milestoneId,
        createdAt: latest.createdAt,
      },
    })
  } catch (error) {
    console.error('[RazorpayOrder GET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
