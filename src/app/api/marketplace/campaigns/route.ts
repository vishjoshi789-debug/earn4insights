/**
 * Marketplace Campaigns API
 * GET /api/marketplace/campaigns — Browse public campaigns with filters
 * Auth: influencer (consumer with is_influencer)
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { getMarketplaceCampaigns } from '@/server/campaignMarketplaceService'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = (session.user as any).id

    const p = req.nextUrl.searchParams
    const filters = {
      category: p.get('category') ?? undefined,
      minBudget: p.get('minBudget') ? parseInt(p.get('minBudget')!) : undefined,
      maxBudget: p.get('maxBudget') ? parseInt(p.get('maxBudget')!) : undefined,
      platform: p.get('platform') ?? undefined,
      niche: p.get('niche') ?? undefined,
      geography: p.get('geography') ?? undefined,
      deadlineBefore: p.get('deadlineBefore') ?? undefined,
      sortBy: (p.get('sortBy') as any) ?? 'newest',
      page: p.get('page') ? parseInt(p.get('page')!) : 1,
      pageSize: 12,
    }

    const result = await getMarketplaceCampaigns(userId, filters)
    return NextResponse.json(result)
  } catch (error) {
    console.error('[Marketplace GET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
