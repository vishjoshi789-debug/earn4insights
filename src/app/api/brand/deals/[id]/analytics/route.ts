/**
 * GET /api/brand/deals/[id]/analytics
 *
 * Get deal performance analytics. Brand must own the deal.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { getBrandDealAnalytics } from '@/server/dealsService'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const role = (session.user as any).role
    if (role !== 'brand') {
      return NextResponse.json({ error: 'Brand access only' }, { status: 403 })
    }
    const userId = (session.user as any).id

    const { id } = await params
    const analytics = await getBrandDealAnalytics(userId, id)
    if (!analytics) return NextResponse.json({ error: 'Deal not found' }, { status: 404 })

    return NextResponse.json({ analytics })
  } catch (error: any) {
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('[BrandDealAnalytics GET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
