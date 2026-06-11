/**
 * POST /api/deals/[id]/redeem
 *
 * Redeem a deal (copy promo code / redirect). Awards 10 points.
 * Auth: consumer required.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { redeemDeal } from '@/server/dealsService'
import {
  requireEmailVerified,
  EmailNotVerifiedError,
  emailNotVerifiedResponseBody,
} from '@/server/emailVerificationGuard'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = (session.user as any).id
    const role = (session.user as any).role
    if (role !== 'consumer') {
      return NextResponse.json(
        { error: 'Only consumers can redeem deals.' },
        { status: 403 },
      )
    }

    // EV.3 — deal redemption joins the 6 EV.1 hard-blocked routes.
    // Awards points → financial action → must be email-verified.
    try {
      await requireEmailVerified(userId)
    } catch (err) {
      if (err instanceof EmailNotVerifiedError) {
        return NextResponse.json(emailNotVerifiedResponseBody(), { status: 403 })
      }
      throw err
    }

    const { id } = await params
    const result = await redeemDeal(id, userId)
    return NextResponse.json(result)
  } catch (error: any) {
    if (error.message === 'Deal not found') {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    if (error.message === 'Deal is not active' || error.message === 'Deal has reached maximum redemptions') {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error('[DealRedeem POST]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
