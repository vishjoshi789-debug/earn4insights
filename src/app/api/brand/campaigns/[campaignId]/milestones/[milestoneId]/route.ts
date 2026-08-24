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

    // ⚠️ action 'escrow' REMOVED in Phase 1 (2026-08-24). It called
    // escrowForMilestone(), which wrote a campaign_payments row reading
    // 'escrowed' without Razorpay holding anything — a brand could fabricate
    // an escrow record with one PATCH. Kept as an explicit 410 rather than
    // falling through to "Invalid action", so an old client or a bookmarked
    // call gets told what happened instead of a generic rejection.
    if (body.action === 'escrow') {
      return NextResponse.json(
        {
          error:
            'Escrow is no longer set by hand. Funds are escrowed by paying the campaign through ' +
            'the Payment tab, which records the payment against this campaign.',
          code: 'escrow_action_removed',
        },
        { status: 410 }
      )
    }

    return NextResponse.json({ error: 'Invalid action. Use: approve, reject' }, { status: 400 })
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
