/**
 * Influencer Campaign Detail API
 *
 * GET   /api/influencer/campaigns/[campaignId] — View campaign details
 * PATCH /api/influencer/campaigns/[campaignId] — Accept/reject invitation, submit milestone
 *
 * Access: authenticated influencer who is invited to this campaign
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { getCampaignSummary, respondToInvitation } from '@/server/campaignManagementService'
import { submitMilestone } from '@/server/campaignPaymentService'
import { getInvitation } from '@/db/repositories/campaignInfluencerRepository'

type RouteParams = { params: Promise<{ campaignId: string }> }

async function getInfluencerUser(): Promise<{ userId: string } | NextResponse> {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return { userId: (session.user as any).id }
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await getInfluencerUser()
    if (authResult instanceof NextResponse) return authResult

    const { campaignId } = await params

    // Verify influencer is part of this campaign
    const invitation = await getInvitation(campaignId, authResult.userId)
    if (!invitation) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const summary = await getCampaignSummary(campaignId)
    return NextResponse.json({ ...summary, invitation })
  } catch (error) {
    console.error('[InfluencerCampaignDetail GET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await getInfluencerUser()
    if (authResult instanceof NextResponse) return authResult

    const { campaignId } = await params
    const body = await req.json().catch(() => null)
    if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

    // Accept/reject invitation
    if (body.action === 'accept' || body.action === 'reject') {
      await respondToInvitation(campaignId, authResult.userId, body.action === 'accept', body.agreedRate)
      return NextResponse.json({ success: true, action: body.action })
    }

    // Submit milestone
    if (body.action === 'submit_milestone' && body.milestoneId) {
      const milestone = await submitMilestone(body.milestoneId, authResult.userId)
      return NextResponse.json({ milestone })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error: any) {
    console.error('[InfluencerCampaignDetail PATCH]', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 400 })
  }
}
