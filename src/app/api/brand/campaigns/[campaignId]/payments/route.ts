/**
 * Campaign Payments API
 *
 * GET /api/brand/campaigns/[campaignId]/payments — Get payment summary
 *
 * Access: brand role, own campaigns only
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { getCampaignPaymentSummary } from '@/server/campaignPaymentService'
import { getCampaignById } from '@/db/repositories/influencerCampaignRepository'

type RouteParams = { params: Promise<{ campaignId: string }> }

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if ((session.user as any).role !== 'brand') {
      return NextResponse.json({ error: 'Brand access only' }, { status: 403 })
    }
    const userId = (session.user as any).id
    const { campaignId } = await params

    const campaign = await getCampaignById(campaignId)
    if (!campaign || campaign.brandId !== userId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const summary = await getCampaignPaymentSummary(campaignId)
    return NextResponse.json(summary)
  } catch (error) {
    console.error('[CampaignPayments GET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
