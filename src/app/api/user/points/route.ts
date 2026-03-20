import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { db } from '@/db'
import { userPoints, pointTransactions } from '@/db/schema'
import { eq, desc } from 'drizzle-orm'

// GET /api/user/points — get current user's point balance & recent transactions
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id

    // Get balance
    const balanceResult = await db
      .select()
      .from(userPoints)
      .where(eq(userPoints.userId, userId))
      .limit(1)

    const balance = balanceResult[0] ?? { totalPoints: 0, lifetimePoints: 0 }

    // Get recent transactions
    const transactions = await db
      .select()
      .from(pointTransactions)
      .where(eq(pointTransactions.userId, userId))
      .orderBy(desc(pointTransactions.createdAt))
      .limit(50)

    return NextResponse.json({ balance, transactions })
  } catch (error) {
    console.error('[User Points GET] Error:', error)
    return NextResponse.json({ error: 'Failed to fetch points' }, { status: 500 })
  }
}
