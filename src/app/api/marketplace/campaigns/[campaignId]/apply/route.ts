/**
 * Campaign Application API
 * POST /api/marketplace/campaigns/[campaignId]/apply — Submit application
 * DELETE /api/marketplace/campaigns/[campaignId]/apply — Withdraw application
 * Auth: influencer
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { applyToCampaign, withdrawApplicationService } from '@/server/campaignMarketplaceService'
import { db } from '@/db'
import { campaignApplications } from '@/db/schema'
import { and, eq } from 'drizzle-orm'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = (session.user as any).id
    const { campaignId } = await params

    const body = await req.json().catch(() => null)
    if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

    const { proposalText, proposedRate, proposedCurrency } = body

    if (!proposalText || typeof proposalText !== 'string' || proposalText.length < 50) {
      return NextResponse.json({ error: 'Proposal must be at least 50 characters' }, { status: 400 })
    }
    if (!proposedRate || typeof proposedRate !== 'number' || proposedRate <= 0) {
      return NextResponse.json({ error: 'Proposed rate must be a positive number' }, { status: 400 })
    }

    const application = await applyToCampaign(userId, campaignId, {
      proposalText,
      proposedRate,
      proposedCurrency: proposedCurrency || 'INR',
    })

    return NextResponse.json({ application }, { status: 201 })
  } catch (error: any) {
    console.error('[Apply POST]', error)
    const msg = error.message || 'Internal server error'
    const status = msg.includes('already applied') || msg.includes('deadline') || msg.includes('maximum') ? 409 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = (session.user as any).id
    const { campaignId } = await params

    // Find the application for this campaign by this influencer
    const [app] = await db.select({ id: campaignApplications.id }).from(campaignApplications)
      .where(and(eq(campaignApplications.campaignId, campaignId), eq(campaignApplications.influencerId, userId)))
      .limit(1)

    if (!app) return NextResponse.json({ error: 'Application not found' }, { status: 404 })

    const result = await withdrawApplicationService(app.id, userId)
    if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Apply DELETE]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
