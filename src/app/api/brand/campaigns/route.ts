/**
 * Brand Campaigns API
 *
 * GET  /api/brand/campaigns — List brand's campaigns
 * POST /api/brand/campaigns — Create new campaign
 *
 * Access: brand role only
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import {
  createNewCampaign,
  getCampaignsByBrand,
} from '@/server/campaignManagementService'

async function getBrandUser(): Promise<{ userId: string } | NextResponse> {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const role = (session.user as any).role
  if (role !== 'brand') {
    return NextResponse.json({ error: 'Brand access only' }, { status: 403 })
  }
  return { userId: (session.user as any).id }
}

export async function GET(req: NextRequest) {
  try {
    const authResult = await getBrandUser()
    if (authResult instanceof NextResponse) return authResult

    const params = req.nextUrl.searchParams
    const status = params.get('status') ?? undefined
    const limit = Math.min(parseInt(params.get('limit') ?? '20'), 50)
    const offset = parseInt(params.get('offset') ?? '0')

    const campaigns = await getCampaignsByBrand(authResult.userId, { status, limit, offset })
    return NextResponse.json({ campaigns, total: campaigns.length })
  } catch (error) {
    console.error('[BrandCampaigns GET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await getBrandUser()
    if (authResult instanceof NextResponse) return authResult

    const body = await req.json().catch(() => null)
    if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

    const { title, brief, requirements, deliverables, targetGeography, targetPlatforms, budgetTotal, budgetCurrency, paymentType, startDate, endDate, productId, icpId } = body

    if (!title || typeof title !== 'string') {
      return NextResponse.json({ error: 'title is required' }, { status: 400 })
    }
    if (!budgetTotal || typeof budgetTotal !== 'number' || budgetTotal <= 0) {
      return NextResponse.json({ error: 'budgetTotal must be a positive number' }, { status: 400 })
    }

    const campaign = await createNewCampaign(authResult.userId, {
      title, brief, requirements, deliverables, targetGeography, targetPlatforms,
      budgetTotal, budgetCurrency, paymentType, startDate, endDate, productId, icpId,
    })

    return NextResponse.json({ campaign }, { status: 201 })
  } catch (error: any) {
    console.error('[BrandCampaigns POST]', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
