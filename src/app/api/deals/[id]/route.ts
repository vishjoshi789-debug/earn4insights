/**
 * GET /api/deals/[id]
 *
 * View a single deal. Increments view count.
 * Optional auth — logged-in users get isSaved/isRedeemed state.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { viewDeal } from '@/server/dealsService'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await auth()
    const userId = session?.user?.email ? (session.user as any).id : undefined

    const deal = await viewDeal(id, userId)
    if (!deal) return NextResponse.json({ error: 'Deal not found' }, { status: 404 })

    return NextResponse.json({ deal })
  } catch (error) {
    console.error('[Deal GET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
