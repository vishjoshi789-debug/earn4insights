/**
 * Influencer Earnings API
 * GET /api/influencer/earnings
 *
 * Returns payment data + aggregated totals for the logged-in influencer.
 * Filter params: ?from=&to=&status=&campaignId=
 *
 * Access: authenticated users with isInfluencer=true
 */

import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { db } from '@/db'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { getEarningsSummary } from '@/server/influencerEarningsService'

export async function GET(req: NextRequest) {
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

    const params = req.nextUrl.searchParams
    const filters = {
      from: params.get('from') ?? undefined,
      to: params.get('to') ?? undefined,
      status: params.get('status') ?? undefined,
      campaignId: params.get('campaignId') ?? undefined,
    }

    const summary = await getEarningsSummary(userId, filters)

    return NextResponse.json(summary)
  } catch (error) {
    console.error('[Influencer Earnings GET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
