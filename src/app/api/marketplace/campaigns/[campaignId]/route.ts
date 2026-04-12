/**
 * Marketplace Campaign Detail
 * GET /api/marketplace/campaigns/[campaignId] — Full detail + application status
 * Auth: influencer
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { getMarketplaceCampaignDetail } from '@/server/campaignMarketplaceService'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = (session.user as any).id
    const { campaignId } = await params

    const result = await getMarketplaceCampaignDetail(campaignId, userId)
    if (!result.campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

    return NextResponse.json(result)
  } catch (error) {
    console.error('[Marketplace Detail GET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
