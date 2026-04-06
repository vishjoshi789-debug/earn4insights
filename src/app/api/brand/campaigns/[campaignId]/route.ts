/**
 * Brand Campaign Detail API
 *
 * GET    /api/brand/campaigns/[campaignId] — Get campaign summary
 * PATCH  /api/brand/campaigns/[campaignId] — Update campaign / change status
 * DELETE /api/brand/campaigns/[campaignId] — Delete draft campaign
 *
 * Access: brand role, own campaigns only
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import {
  getCampaignSummary,
  updateCampaignDetails,
  transitionCampaignStatus,
  removeCampaign,
} from '@/server/campaignManagementService'

type RouteParams = { params: Promise<{ campaignId: string }> }

async function getBrandUser(): Promise<{ userId: string } | NextResponse> {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if ((session.user as any).role !== 'brand') {
    return NextResponse.json({ error: 'Brand access only' }, { status: 403 })
  }
  return { userId: (session.user as any).id }
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await getBrandUser()
    if (authResult instanceof NextResponse) return authResult

    const { campaignId } = await params
    const summary = await getCampaignSummary(campaignId)
    if (!summary) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    if (summary.campaign.brandId !== authResult.userId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    return NextResponse.json(summary)
  } catch (error) {
    console.error('[BrandCampaignDetail GET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await getBrandUser()
    if (authResult instanceof NextResponse) return authResult

    const { campaignId } = await params
    const body = await req.json().catch(() => null)
    if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

    // Status transition
    if (body.status) {
      const campaign = await transitionCampaignStatus(campaignId, body.status, authResult.userId)
      return NextResponse.json({ campaign })
    }

    // Detail update
    const campaign = await updateCampaignDetails(campaignId, authResult.userId, body)
    return NextResponse.json({ campaign })
  } catch (error: any) {
    console.error('[BrandCampaignDetail PATCH]', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 400 })
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await getBrandUser()
    if (authResult instanceof NextResponse) return authResult

    const { campaignId } = await params
    await removeCampaign(campaignId, authResult.userId)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[BrandCampaignDetail DELETE]', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 400 })
  }
}
