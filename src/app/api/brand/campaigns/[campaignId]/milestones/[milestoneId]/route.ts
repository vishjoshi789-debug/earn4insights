/**
 * Campaign Milestone Detail API
 *
 * PATCH  /api/brand/campaigns/[campaignId]/milestones/[milestoneId] — Approve/reject milestone
 * DELETE /api/brand/campaigns/[campaignId]/milestones/[milestoneId] — Delete pending milestone
 *
 * Access: brand role, own campaigns only
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import {
  approveMilestone,
  rejectMilestone,
  removeMilestone,
  escrowForMilestone,
} from '@/server/campaignPaymentService'

type RouteParams = { params: Promise<{ campaignId: string; milestoneId: string }> }

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

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await getBrandUser()
    if (authResult instanceof NextResponse) return authResult

    const { milestoneId } = await params
    const body = await req.json().catch(() => null)
    if (!body?.action) return NextResponse.json({ error: 'action required' }, { status: 400 })

    if (body.action === 'approve') {
      const result = await approveMilestone(milestoneId, authResult.userId)
      return NextResponse.json(result)
    }

    if (body.action === 'reject') {
      const milestone = await rejectMilestone(milestoneId, authResult.userId)
      return NextResponse.json({ milestone })
    }

    if (body.action === 'escrow') {
      const payment = await escrowForMilestone(milestoneId, authResult.userId)
      return NextResponse.json({ payment })
    }

    return NextResponse.json({ error: 'Invalid action. Use: approve, reject, escrow' }, { status: 400 })
  } catch (error: any) {
    console.error('[MilestoneDetail PATCH]', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 400 })
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await getBrandUser()
    if (authResult instanceof NextResponse) return authResult

    const { milestoneId } = await params
    await removeMilestone(milestoneId, authResult.userId)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[MilestoneDetail DELETE]', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 400 })
  }
}
