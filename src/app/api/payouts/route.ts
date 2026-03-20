import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { db } from '@/db'
import { payoutRequests, users, userReputation } from '@/db/schema'
import { eq, desc, sql } from 'drizzle-orm'
import { getUserBalance, deductPoints, POINTS_PER_DOLLAR } from '@/server/pointsService'

// GET /api/payouts — list payout requests (consumers see own, brands see all)
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const role = (session.user as any).role

    if (role === 'brand') {
      // Brand view: see all payouts with user info
      const payouts = await db
        .select({
          id: payoutRequests.id,
          userId: payoutRequests.userId,
          points: payoutRequests.points,
          amount: payoutRequests.amount,
          status: payoutRequests.status,
          requestedAt: payoutRequests.requestedAt,
          processedAt: payoutRequests.processedAt,
          note: payoutRequests.note,
          userName: users.name,
        })
        .from(payoutRequests)
        .leftJoin(users, eq(payoutRequests.userId, users.id))
        .orderBy(desc(payoutRequests.requestedAt))
        .limit(100)

      return NextResponse.json({ payouts })
    } else {
      // Consumer: own payouts only
      const payouts = await db
        .select()
        .from(payoutRequests)
        .where(eq(payoutRequests.userId, session.user.id))
        .orderBy(desc(payoutRequests.requestedAt))
        .limit(50)

      const balance = await getUserBalance(session.user.id)

      // Include reputation info for display
      const [rep] = await db
        .select({
          tier: userReputation.tier,
          reputationScore: userReputation.reputationScore,
          earningMultiplier: userReputation.earningMultiplier,
        })
        .from(userReputation)
        .where(eq(userReputation.userId, session.user.id))
        .limit(1)

      return NextResponse.json({ payouts, balance, reputation: rep || null })
    }
  } catch (error) {
    console.error('[Payouts GET] Error:', error)
    return NextResponse.json({ error: 'Failed to fetch payouts' }, { status: 500 })
  }
}

// POST /api/payouts — request a payout (consumer)
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { points } = await req.json()
    if (!points || points < 500) {
      return NextResponse.json({ error: 'Minimum payout is 500 points ($5)' }, { status: 400 })
    }

    const amount = (points / POINTS_PER_DOLLAR).toFixed(2)

    // Deduct points
    const success = await deductPoints(
      session.user.id,
      points,
      'payout',
      undefined,
      `Payout request: $${amount}`,
    )

    if (!success) {
      return NextResponse.json({ error: 'Insufficient points' }, { status: 400 })
    }

    await db.insert(payoutRequests).values({
      userId: session.user.id,
      points,
      amount,
      status: 'pending',
    })

    const newBalance = await getUserBalance(session.user.id)

    return NextResponse.json({ success: true, newBalance })
  } catch (error) {
    console.error('[Payouts POST] Error:', error)
    return NextResponse.json({ error: 'Failed to request payout' }, { status: 500 })
  }
}

// PATCH /api/payouts — approve/deny a payout (brand only)
export async function PATCH(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const role = (session.user as any).role
    if (role !== 'brand') {
      return NextResponse.json({ error: 'Only brand users can process payouts' }, { status: 403 })
    }

    const { payoutId, action, note } = await req.json()
    if (!payoutId || !['approved', 'denied'].includes(action)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    // Fetch payout
    const payout = await db
      .select()
      .from(payoutRequests)
      .where(eq(payoutRequests.id, payoutId))
      .limit(1)

    if (payout.length === 0) {
      return NextResponse.json({ error: 'Payout not found' }, { status: 404 })
    }

    if (payout[0].status !== 'pending') {
      return NextResponse.json({ error: 'Payout already processed' }, { status: 400 })
    }

    await db
      .update(payoutRequests)
      .set({
        status: action,
        processedAt: new Date(),
        processedBy: session.user.id,
        note: note || null,
      })
      .where(eq(payoutRequests.id, payoutId))

    // If denied, refund points
    if (action === 'denied') {
      const { awardPoints } = await import('@/server/pointsService')
      await awardPoints(
        payout[0].userId,
        payout[0].points,
        'refund',
        payoutId,
        'Payout request denied — points refunded',
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Payouts PATCH] Error:', error)
    return NextResponse.json({ error: 'Failed to process payout' }, { status: 500 })
  }
}
