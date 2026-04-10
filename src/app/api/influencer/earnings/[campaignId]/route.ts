/**
 * Influencer Campaign Deep Dive API
 * GET /api/influencer/earnings/[campaignId]
 *
 * Returns full performance breakdown + daily time series for a
 * specific campaign. Verifies the influencer is part of the campaign.
 *
 * Access: authenticated users with isInfluencer=true
 */

import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { db } from '@/db'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { getCampaignDeepDiveData } from '@/server/influencerEarningsService'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> },
) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    })
    if (!user?.isInfluencer) {
      return NextResponse.json({ error: 'Influencer access only' }, { status: 403 })
    }

    const { campaignId } = await params

    if (!campaignId) {
      return NextResponse.json({ error: 'Campaign ID required' }, { status: 400 })
    }

    const deepDive = await getCampaignDeepDiveData(userId, campaignId)

    if (!deepDive) {
      return NextResponse.json(
        { error: 'Campaign not found or access denied' },
        { status: 404 },
      )
    }

    return NextResponse.json(deepDive)
  } catch (error) {
    console.error('[Influencer Campaign Deep Dive GET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
