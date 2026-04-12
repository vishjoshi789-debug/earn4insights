/**
 * Brand Campaign Applications API
 * GET /api/brand/campaigns/[campaignId]/applications — All applications for a campaign
 * Auth: brand (must own campaign)
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { getApplicationsForCampaign } from '@/server/campaignMarketplaceService'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const role = (session.user as any).role
    if (role !== 'brand') return NextResponse.json({ error: 'Brand access only' }, { status: 403 })
    const userId = (session.user as any).id
    const { campaignId } = await params

    const result = await getApplicationsForCampaign(campaignId, userId)
    if (!result.isBrandOwner) return NextResponse.json({ error: 'Not your campaign' }, { status: 403 })

    return NextResponse.json({ applications: result.applications })
  } catch (error) {
    console.error('[Brand Applications GET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
