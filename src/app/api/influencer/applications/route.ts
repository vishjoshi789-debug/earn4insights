/**
 * Influencer Applications API
 * GET /api/influencer/applications — All applications by this influencer
 * Auth: influencer
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { getApplicationsForInfluencer } from '@/server/campaignMarketplaceService'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = (session.user as any).id

    const status = req.nextUrl.searchParams.get('status') ?? undefined
    const applications = await getApplicationsForInfluencer(userId, status)
    return NextResponse.json({ applications })
  } catch (error) {
    console.error('[Influencer Applications GET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
