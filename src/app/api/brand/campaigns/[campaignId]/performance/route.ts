/**
 * Campaign Performance API
 *
 * GET  /api/brand/campaigns/[campaignId]/performance — Get campaign analytics
 * POST /api/brand/campaigns/[campaignId]/performance — Record metrics
 *
 * Access: brand role (GET), brand or invited influencer (POST)
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import {
  getCampaignAnalytics,
  recordCampaignMetrics,
} from '@/server/campaignPerformanceService'
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

    const analytics = await getCampaignAnalytics(campaignId)
    return NextResponse.json(analytics)
  } catch (error) {
    console.error('[CampaignPerformance GET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = (session.user as any).id
    const { campaignId } = await params

    const body = await req.json().catch(() => null)
    if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

    if (!body.platform || !body.metricDate) {
      return NextResponse.json({ error: 'platform and metricDate required' }, { status: 400 })
    }

    const metrics = await recordCampaignMetrics(campaignId, userId, body)
    return NextResponse.json({ metrics }, { status: 201 })
  } catch (error: any) {
    console.error('[CampaignPerformance POST]', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 400 })
  }
}
