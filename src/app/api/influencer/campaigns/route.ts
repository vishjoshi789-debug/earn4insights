/**
 * Influencer Campaigns API
 *
 * GET /api/influencer/campaigns — List campaigns the influencer is invited to / part of
* Query: ?participating=true (campaigns the creator is ON) OR ?status=invited|accepted|active|completed
 *
 * Access: authenticated influencers
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { getCampaignsByInfluencer } from '@/server/campaignManagementService'
import { getParticipatingCampaignsForInfluencer } from '@/db/repositories/influencerCampaignRepository'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = (session.user as any).id

    // ?participating=true — campaigns the creator is actually ON
    // (accepted/active/completed). Backs the content-submission selector.
    //
    // ⚠️ Not expressible via ?status=, which takes a SINGLE value: unfiltered
    // returns everything including 'invited' and 'rejected', and
    // ?status=accepted misses 'active' and 'completed'. Offering an INVITED
    // campaign in the selector would let a creator attach work to a campaign
    // they never joined — and a brand-approved post on a campaign is what
    // authorises the campaign-level payment release.
    //
    // Same predicate the submit-time membership check and the payment path
    // use — see lib/campaigns/participation for why that is one definition.
    if (req.nextUrl.searchParams.get('participating') === 'true') {
      const campaigns = await getParticipatingCampaignsForInfluencer(userId)
      return NextResponse.json({ campaigns, total: campaigns.length })
    }

    const status = req.nextUrl.searchParams.get('status') ?? undefined
    const campaigns = await getCampaignsByInfluencer(userId, { status })

    return NextResponse.json({ campaigns, total: campaigns.length })
  } catch (error) {
    console.error('[InfluencerCampaigns GET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
