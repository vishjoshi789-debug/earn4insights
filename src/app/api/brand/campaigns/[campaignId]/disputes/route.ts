/**
 * Campaign Disputes API (Brand side)
 *
 * GET  /api/brand/campaigns/[campaignId]/disputes — List disputes
 * POST /api/brand/campaigns/[campaignId]/disputes — Raise dispute
 *
 * Access: brand role, own campaigns
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { raiseDispute, getDisputesByCampaign } from '@/server/disputeResolutionService'
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

    const disputes = await getDisputesByCampaign(campaignId)
    return NextResponse.json({ disputes })
  } catch (error) {
    console.error('[BrandDisputes GET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await getBrandUser()
    if (authResult instanceof NextResponse) return authResult

    const { campaignId } = await params
    const body = await req.json().catch(() => null)
    if (!body?.reason) {
      return NextResponse.json({ error: 'reason is required' }, { status: 400 })
    }

    const dispute = await raiseDispute(campaignId, authResult.userId, {
      reason: body.reason,
      evidence: body.evidence,
    })

    return NextResponse.json({ dispute }, { status: 201 })
  } catch (error: any) {
    console.error('[BrandDisputes POST]', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 400 })
  }
}
