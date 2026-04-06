/**
 * Campaign Disputes API (Influencer side + Admin resolve)
 *
 * GET   /api/campaigns/[campaignId]/disputes — List disputes (any participant)
 * POST  /api/campaigns/[campaignId]/disputes — Raise dispute (influencer)
 * PATCH /api/campaigns/[campaignId]/disputes — Resolve dispute (admin: body { disputeId, resolution, status })
 *
 * Access: campaign participants (GET/POST), admin (PATCH)
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import {
  raiseDispute,
  resolveDisputeAsAdmin,
  markDisputeUnderReview,
  getDisputesByCampaign,
} from '@/server/disputeResolutionService'

type RouteParams = { params: Promise<{ campaignId: string }> }

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { campaignId } = await params
    const disputes = await getDisputesByCampaign(campaignId)
    return NextResponse.json({ disputes })
  } catch (error) {
    console.error('[Disputes GET]', error)
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
    if (!body?.reason) {
      return NextResponse.json({ error: 'reason is required' }, { status: 400 })
    }

    const dispute = await raiseDispute(campaignId, userId, {
      reason: body.reason,
      evidence: body.evidence,
    })

    return NextResponse.json({ dispute }, { status: 201 })
  } catch (error: any) {
    console.error('[Disputes POST]', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 400 })
  }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = (session.user as any).id
    const role = (session.user as any).role

    if (role !== 'admin') {
      return NextResponse.json({ error: 'Admin access only' }, { status: 403 })
    }

    const body = await req.json().catch(() => null)
    if (!body?.disputeId) {
      return NextResponse.json({ error: 'disputeId required' }, { status: 400 })
    }

    if (body.action === 'review') {
      await markDisputeUnderReview(body.disputeId)
      return NextResponse.json({ success: true })
    }

    if (!body.resolution || !body.status) {
      return NextResponse.json({ error: 'resolution and status required' }, { status: 400 })
    }

    const dispute = await resolveDisputeAsAdmin(body.disputeId, userId, {
      resolution: body.resolution,
      status: body.status,
    })

    return NextResponse.json({ dispute })
  } catch (error: any) {
    console.error('[Disputes PATCH]', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 400 })
  }
}
