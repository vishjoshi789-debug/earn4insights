/**
 * Campaign Influencer Management API
 *
 * GET  /api/brand/campaigns/[campaignId]/influencers — List influencers in campaign
 * POST /api/brand/campaigns/[campaignId]/influencers — Invite influencer
 * DELETE /api/brand/campaigns/[campaignId]/influencers — Remove influencer (body: { influencerId })
 *
 * Access: brand role, own campaigns only
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import {
  inviteInfluencerToCampaign,
  markInfluencerComplete,
  removeInfluencerFromCampaign,
} from '@/server/campaignManagementService'
import { getInfluencersByCampaign } from '@/db/repositories/campaignInfluencerRepository'
import { getCampaignById } from '@/db/repositories/influencerCampaignRepository'

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
    const campaign = await getCampaignById(campaignId)
    if (!campaign || campaign.brandId !== authResult.userId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const influencers = await getInfluencersByCampaign(campaignId)
    return NextResponse.json({ influencers })
  } catch (error) {
    console.error('[CampaignInfluencers GET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await getBrandUser()
    if (authResult instanceof NextResponse) return authResult

    const { campaignId } = await params
    const body = await req.json().catch(() => null)
    if (!body?.influencerId) {
      return NextResponse.json({ error: 'influencerId is required' }, { status: 400 })
    }

    await inviteInfluencerToCampaign(campaignId, body.influencerId, authResult.userId, {
      deliverables: body.deliverables,
      agreedRate: body.agreedRate,
    })

    return NextResponse.json({ success: true }, { status: 201 })
  } catch (error: any) {
    console.error('[CampaignInfluencers POST]', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 400 })
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await getBrandUser()
    if (authResult instanceof NextResponse) return authResult

    const { campaignId } = await params
    const body = await req.json().catch(() => null)
    if (!body?.influencerId) {
      return NextResponse.json({ error: 'influencerId is required' }, { status: 400 })
    }

    await removeInfluencerFromCampaign(campaignId, body.influencerId, authResult.userId)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[CampaignInfluencers DELETE]', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 400 })
  }
}
