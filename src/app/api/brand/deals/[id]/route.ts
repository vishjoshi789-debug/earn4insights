/**
 * PATCH /api/brand/deals/[id]
 *
 * Update a deal (draft or active). Brand must own the deal.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { updateBrandDeal } from '@/server/dealsService'

export async function PATCH(
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

    const body = await req.json().catch(() => null)
    if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

    const { id } = await params
    const deal = await updateBrandDeal(userId, id, body)
    return NextResponse.json({ deal })
  } catch (error: any) {
    if (error.message === 'Deal not found') {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('[BrandDeal PATCH]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
