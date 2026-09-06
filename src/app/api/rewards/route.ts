import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { db } from '@/db'
import { rewards, rewardRedemptions } from '@/db/schema'
import { eq, and, desc, sql } from 'drizzle-orm'
import { getUserBalance, deductPoints } from '@/server/pointsService'

// GET /api/rewards — list available rewards
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const catalog = await db
      .select()
      .from(rewards)
      .where(eq(rewards.isActive, true))
      .orderBy(rewards.pointsCost)

    const balance = await getUserBalance(session.user.id)

    // Get user's redemption history
    const redemptions = await db
      .select({
        id: rewardRedemptions.id,
        rewardId: rewardRedemptions.rewardId,
        pointsSpent: rewardRedemptions.pointsSpent,
        status: rewardRedemptions.status,
        createdAt: rewardRedemptions.createdAt,
      })
      .from(rewardRedemptions)
      .where(eq(rewardRedemptions.userId, session.user.id))
      .orderBy(desc(rewardRedemptions.createdAt))
      .limit(20)

    return NextResponse.json({ catalog, balance, redemptions })
  } catch (error) {
    console.error('[Rewards GET] Error:', error)
    return NextResponse.json({ error: 'Failed to fetch rewards' }, { status: 500 })
  }
}

// POST /api/rewards — redeem a reward
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { rewardId } = await req.json()
    if (!rewardId) {
      return NextResponse.json({ error: 'Reward ID required' }, { status: 400 })
    }

    // Fetch reward
    const reward = await db
      .select()
      .from(rewards)
      .where(eq(rewards.id, rewardId))
      .limit(1)

    if (reward.length === 0 || !reward[0].isActive) {
      return NextResponse.json({ error: 'Reward not found or inactive' }, { status: 404 })
    }

    const r = reward[0]

    // Check stock
    if (r.stock !== null && r.stock <= 0) {
      return NextResponse.json({ error: 'Out of stock' }, { status: 400 })
    }

    // ── Deduct, decrement stock, and record — ONE transaction ──────
    //
    // ⚠️ These were THREE independent writes. deductPoints was internally
    // transactional so the deduction committed alone, and a failure in either
    // later write left the user with points gone and either stock silently
    // decremented for a redemption that does not exist, or no record of what
    // they redeemed at all. All three now commit together or not at all.
    //
    // ⚠️ Stock is decremented with a GUARDED update (`stock > 0`) rather than
    // a bare decrement. The earlier `if (r.stock <= 0)` check read a value
    // fetched before the deduction, so two concurrent redemptions of the last
    // item could both pass it and drive stock to -1. Inside the transaction
    // the row lock plus the WHERE makes the loser's update affect 0 rows,
    // which we surface as out-of-stock and roll back.
    let insufficientPoints = false
    let outOfStock = false

    await db.transaction(async (tx) => {
      const success = await deductPoints(
        session.user.id,
        r.pointsCost,
        'reward_redeem',
        r.id,
        `Redeemed: ${r.name}`,
        tx,
      )
      if (!success) {
        insufficientPoints = true
        return
      }

      if (r.stock !== null) {
        const decremented = await tx
          .update(rewards)
          .set({ stock: sql`${rewards.stock} - 1` })
          .where(and(eq(rewards.id, r.id), sql`${rewards.stock} > 0`))
          .returning({ stock: rewards.stock })

        if (decremented.length === 0) {
          outOfStock = true
          throw new Error('ROLLBACK_OUT_OF_STOCK') // roll the deduction back
        }
      }

      await tx.insert(rewardRedemptions).values({
        userId: session.user.id,
        rewardId: r.id,
        pointsSpent: r.pointsCost,
        status: 'pending',
      })
    }).catch((err) => {
      // Only our own rollback signal is expected here; anything else is a real
      // failure and must not be swallowed into a misleading 400.
      if (!outOfStock) throw err
    })

    if (insufficientPoints) {
      return NextResponse.json({ error: 'Insufficient points' }, { status: 400 })
    }
    if (outOfStock) {
      return NextResponse.json({ error: 'Out of stock' }, { status: 400 })
    }

    const newBalance = await getUserBalance(session.user.id)

    return NextResponse.json({ success: true, newBalance })
  } catch (error) {
    console.error('[Rewards POST] Error:', error)
    return NextResponse.json({ error: 'Failed to redeem reward' }, { status: 500 })
  }
}
