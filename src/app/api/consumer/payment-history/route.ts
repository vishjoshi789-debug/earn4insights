/**
 * GET /api/consumer/payment-history
 *
 * Returns the authenticated consumer's reward redemption history.
 *
 * Auth: consumer role
 */

import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { getRedemptionsForConsumer } from '@/db/repositories/rewardRedemptionRepository'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const user = session.user as any
    if (user.role !== 'consumer') {
      return NextResponse.json({ error: 'Consumer access only' }, { status: 403 })
    }
    const userId: string = user.id

    const redemptions = await getRedemptionsForConsumer(userId)

    return NextResponse.json({ redemptions })
  } catch (error) {
    console.error('[ConsumerPaymentHistory GET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
