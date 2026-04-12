/**
 * Recommended Campaigns API
 * GET /api/marketplace/campaigns/recommended — Top 6 for this influencer
 * Auth: influencer
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { getRecommendedCampaigns } from '@/server/campaignMarketplaceService'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = (session.user as any).id

    const campaigns = await getRecommendedCampaigns(userId)
    return NextResponse.json({ campaigns })
  } catch (error) {
    console.error('[Marketplace Recommended GET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
