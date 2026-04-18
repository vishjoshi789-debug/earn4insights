/**
 * GET /api/deals/redemptions
 *
 * List deals redeemed by the current user. Auth required.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { getUserRedemptions } from '@/server/dealsService'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = (session.user as any).id

    const p = req.nextUrl.searchParams
    const result = await getUserRedemptions(
      userId,
      p.get('cursor') ?? undefined,
      Math.min(parseInt(p.get('limit') ?? '20'), 50)
    )
    return NextResponse.json(result)
  } catch (error) {
    console.error('[DealsRedemptions GET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
