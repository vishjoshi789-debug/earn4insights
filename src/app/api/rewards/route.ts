import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { db } from '@/db'
import { rewards, rewardRedemptions } from '@/db/schema'
import { eq, desc, sql } from 'drizzle-orm'
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

    // Deduct points
    const success = await deductPoints(
      session.user.id,
      r.pointsCost,
      'reward_redeem',
      r.id,
      `Redeemed: ${r.name}`,
    )

    if (!success) {
      return NextResponse.json({ error: 'Insufficient points' }, { status: 400 })
    }

    // Decrement stock if limited
    if (r.stock !== null) {
      await db
        .update(rewards)
        .set({ stock: sql`${rewards.stock} - 1` })
        .where(eq(rewards.id, r.id))
    }

    // Create redemption record
    await db.insert(rewardRedemptions).values({
      userId: session.user.id,
      rewardId: r.id,
      pointsSpent: r.pointsCost,
      status: 'pending',
    })

    const newBalance = await getUserBalance(session.user.id)

    return NextResponse.json({ success: true, newBalance })
  } catch (error) {
    console.error('[Rewards POST] Error:', error)
    return NextResponse.json({ error: 'Failed to redeem reward' }, { status: 500 })
  }
}
