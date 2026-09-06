import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { validateCsrfToken, csrfErrorResponse } from '@/lib/csrf'
import { isAdminSession } from '@/lib/auth/roles'
import { db } from '@/db'
import { payoutRequests, users, userReputation } from '@/db/schema'
import { eq, desc, sql } from 'drizzle-orm'
import { getUserBalance, deductPoints } from '@/server/pointsService'
import { PAISE_PER_POINT, MINIMUM_REDEMPTION_POINTS } from '@/lib/points/rate'

// GET /api/payouts — list payout requests (consumers see own, ADMINS see all)
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // ⚠️ ADMIN, NOT BRAND. This branch returns EVERY consumer's payout requests
    // — id, points, amount, status and the consumer's NAME — with no scoping of
    // any kind. It was gated on `role === 'brand'`, so any brand account could
    // list the entire platform's consumer payout history.
    //
    // A brand has no legitimate interest here at all: these are platform-points
    // payouts funded by us, not by any brand, and the requesting consumer need
    // never have interacted with that brand. Cross-tenant financial data plus
    // PII, in one query.
    //
    // Uses isAdminSession() rather than a local role cast — the single home for
    // that check since v15 (lib/auth/roles.ts).
    if (isAdminSession(session)) {
      // Admin view: all payout requests, for processing the queue
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
  if (!validateCsrfToken(req)) return csrfErrorResponse()
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { points } = await req.json()
    if (!points || points < MINIMUM_REDEMPTION_POINTS) {
      return NextResponse.json({ error: 'Minimum payout is 500 points (₹50)' }, { status: 400 })
    }

    // ⚠️ ₹ NOT $. This computed `points / POINTS_PER_DOLLAR` — 100 points = $1
    // — while /api/consumer/rewards/redeem paid 10 paise per point for the
    // same points. An ~8x difference decided only by which screen the consumer
    // used. Single rate now lives in lib/points/rate.
    //
    // `payout_requests.amount` is a decimal column commented "USD"; it is now
    // RUPEES. The two pre-existing rows were recorded under the old rate — see
    // the recompute note in SESSION_RESUME.
    const amount = (points * PAISE_PER_POINT / 100).toFixed(2)

    // Deduct points
    const success = await deductPoints(
      session.user.id,
      points,
      'payout',
      undefined,
      `Payout request: ₹${amount}`,
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

// PATCH /api/payouts — approve/deny a payout (ADMIN only)
export async function PATCH(req: NextRequest) {
  if (!validateCsrfToken(req)) return csrfErrorResponse()
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // ⚠️ ADMIN, NOT BRAND — and this fixes two defects at once.
    //
    // (1) SECURITY: the check was `role !== 'brand'`, so ANY brand account
    //     could approve or deny ANY consumer's payout request. There was no
    //     ownership check and no relationship required — it fetched by
    //     payoutId and updated. Financial control over other people's money.
    //
    // (2) NOBODY COULD PROCESS THEM: the same strict check EXCLUDED admins, so
    //     the one role that should action this queue got a 403. That is why the
    //     oldest pending request sat unprocessed for over six weeks — the role
    //     that could act had no reason to, and the role that should act was
    //     locked out.
    if (!isAdminSession(session)) {
      return NextResponse.json(
        { error: 'Only admins can process payout requests' },
        { status: 403 }
      )
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

    // If denied, refund points — but only if the requester still exists.
    // user_id is SET NULL once the account is erased (B33); a deleted user has
    // no user_points row to refund (CASCADE-deleted), so skip.
    if (action === 'denied' && payout[0].userId) {
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
