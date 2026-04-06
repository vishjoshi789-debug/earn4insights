/**
 * Influencer Campaigns API
 *
 * GET /api/influencer/campaigns — List campaigns the influencer is invited to / part of
 * Query: ?status=invited|accepted|active|completed
 *
 * Access: authenticated influencers
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { getCampaignsByInfluencer } from '@/server/campaignManagementService'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = (session.user as any).id

    const status = req.nextUrl.searchParams.get('status') ?? undefined
    const campaigns = await getCampaignsByInfluencer(userId, { status })

    return NextResponse.json({ campaigns, total: campaigns.length })
  } catch (error) {
    console.error('[InfluencerCampaigns GET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
