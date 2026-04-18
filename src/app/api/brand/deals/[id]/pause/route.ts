/**
 * POST /api/brand/deals/[id]/pause
 *
 * Pause an active deal (set status to 'paused'). Brand must own the deal.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { pauseDeal } from '@/server/dealsService'

export async function POST(
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
    const deal = await pauseDeal(userId, id)
    return NextResponse.json({ deal })
  } catch (error: any) {
    if (error.message === 'Deal not found') {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('[BrandDealPause POST]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
