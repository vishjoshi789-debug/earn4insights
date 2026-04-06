/**
 * Campaign Reviews API
 *
 * GET  /api/campaigns/[campaignId]/reviews — List reviews for a campaign
 * POST /api/campaigns/[campaignId]/reviews — Leave a review
 *
 * Access: authenticated users who are part of the campaign
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import {
  createReview,
  getReviewsByCampaign,
  getReviewByReviewer,
} from '@/db/repositories/influencerReviewRepository'
import { getCampaignById } from '@/db/repositories/influencerCampaignRepository'
import { getInvitation } from '@/db/repositories/campaignInfluencerRepository'

type RouteParams = { params: Promise<{ campaignId: string }> }

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { campaignId } = await params
    const reviews = await getReviewsByCampaign(campaignId)
    return NextResponse.json({ reviews })
  } catch (error) {
    console.error('[CampaignReviews GET]', error)
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

    const campaign = await getCampaignById(campaignId)
    if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

    // Only completed campaigns can be reviewed
    if (campaign.status !== 'completed') {
      return NextResponse.json({ error: 'Can only review completed campaigns' }, { status: 400 })
    }

    // Verify user is part of campaign (brand or invited influencer)
    const isBrand = campaign.brandId === userId
    if (!isBrand) {
      const invitation = await getInvitation(campaignId, userId)
      if (!invitation || !['accepted', 'active', 'completed'].includes(invitation.status)) {
        return NextResponse.json({ error: 'Not authorized to review this campaign' }, { status: 403 })
      }
    }

    // Check if already reviewed
    const existing = await getReviewByReviewer(campaignId, userId)
    if (existing) {
      return NextResponse.json({ error: 'You have already reviewed this campaign' }, { status: 409 })
    }

    const body = await req.json().catch(() => null)
    if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

    if (!body.revieweeId || !body.rating) {
      return NextResponse.json({ error: 'revieweeId and rating required' }, { status: 400 })
    }

    if (body.rating < 1 || body.rating > 5) {
      return NextResponse.json({ error: 'Rating must be 1-5' }, { status: 400 })
    }

    const review = await createReview({
      campaignId,
      reviewerId: userId,
      revieweeId: body.revieweeId,
      rating: body.rating,
      review: body.review ?? null,
    })

    return NextResponse.json({ review }, { status: 201 })
  } catch (error: any) {
    console.error('[CampaignReviews POST]', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 400 })
  }
}
