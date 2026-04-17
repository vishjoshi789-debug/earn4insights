/**
 * GET /api/influencer/payouts
 *
 * Paginated payout history for the authenticated influencer.
 *
 * Query params:
 *   status  — filter by status (pending|processing|completed|failed)
 *   from    — ISO date string (inclusive)
 *   to      — ISO date string (inclusive)
 *   page    — page number (default 1)
 *   limit   — items per page (default 20, max 50)
 *
 * Auth: consumer role + isInfluencer = true
 */

import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { getPayoutsForRecipient } from '@/db/repositories/razorpayRepository'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const user = session.user as any
    if (!user.isInfluencer) {
      return NextResponse.json({ error: 'Influencer access only' }, { status: 403 })
    }
    const userId: string = user.id

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') ?? undefined
    const from = searchParams.get('from') ? new Date(searchParams.get('from')!) : undefined
    const to = searchParams.get('to') ? new Date(searchParams.get('to')!) : undefined
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)))
    const offset = (page - 1) * limit

    const validStatuses = ['pending', 'processing', 'completed', 'failed']
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status filter' }, { status: 400 })
    }

    const payouts = await getPayoutsForRecipient(userId, { status, from, to, limit, offset })

    // Strip internal fields — never return account details
    const safePayouts = payouts.map((p) => ({
      id: p.id,
      campaignId: p.campaignId,
      amount: p.amount,
      currency: p.currency,
      payoutMethod: p.payoutMethod,
      status: p.status,
      failureReason: p.status === 'failed' ? p.failureReason : undefined,
      retryCount: p.retryCount,
      initiatedAt: p.initiatedAt,
      completedAt: p.completedAt,
      createdAt: p.createdAt,
    }))

    return NextResponse.json({
      payouts: safePayouts,
      page,
      limit,
    })
  } catch (error) {
    console.error('[InfluencerPayouts GET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
