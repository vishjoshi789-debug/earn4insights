/**
 * Campaign Milestones API
 *
 * GET  /api/brand/campaigns/[campaignId]/milestones — List milestones
 * POST /api/brand/campaigns/[campaignId]/milestones — Create milestone
 *
 * Access: brand role, own campaigns only
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { addMilestone } from '@/server/campaignPaymentService'
import { getMilestonesByCampaign } from '@/db/repositories/campaignMilestoneRepository'
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

    const milestones = await getMilestonesByCampaign(campaignId)
    return NextResponse.json({ milestones })
  } catch (error) {
    console.error('[Milestones GET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await getBrandUser()
    if (authResult instanceof NextResponse) return authResult

    const { campaignId } = await params
    const body = await req.json().catch(() => null)
    if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

    if (!body.title || !body.paymentAmount || body.paymentAmount <= 0) {
      return NextResponse.json({ error: 'title and positive paymentAmount required' }, { status: 400 })
    }

    const milestone = await addMilestone(campaignId, authResult.userId, {
      title: body.title,
      description: body.description,
      dueDate: body.dueDate,
      paymentAmount: body.paymentAmount,
      sortOrder: body.sortOrder,
    })

    return NextResponse.json({ milestone }, { status: 201 })
  } catch (error: any) {
    console.error('[Milestones POST]', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 400 })
  }
}
