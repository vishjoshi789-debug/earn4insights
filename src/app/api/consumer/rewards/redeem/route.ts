/**
 * POST /api/consumer/rewards/redeem
 *
 * Consumer redeems points for platform credits, voucher, or cash payout.
 *
 * Body: { points, redemptionType, payoutAccountId? }
 *
 * Rules:
 *   - Minimum 500 points per redemption
 *   - Must have sufficient balance
 *   - No duplicate pending redemption (one at a time)
 *   - Cash payout requires a payout account
 *
 * Auth: consumer role
 */

import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { db } from '@/db'
import { getUserBalance, deductPoints } from '@/server/pointsService'
import { PAISE_PER_POINT, MINIMUM_REDEMPTION_POINTS } from '@/lib/points/rate'
import {
  createRedemption,
  getPendingRedemptions,
} from '@/db/repositories/rewardRedemptionRepository'
import { getAccountById } from '@/db/repositories/payoutAccountRepository'
import { initiateRecipientPayout, PayoutAccountMissingError } from '@/server/payoutService'
import {
  requireEmailVerified,
  EmailNotVerifiedError,
  emailNotVerifiedResponseBody,
} from '@/server/emailVerificationGuard'
import { convertToMinor } from '@/lib/currency'
import { emit, PLATFORM_EVENTS } from '@/server/eventBus'

// MINIMUM_REDEMPTION_POINTS now shared — see lib/points/rate.
// ⚠️ PAISE_PER_POINT now comes from lib/points/rate — it used to be redeclared
// HERE while this file simultaneously imported POINTS_PER_DOLLAR (100 pts =
// $1) and never used it. Two rates in one file, one live and one dead beside
// it, is how the wrong constant gets picked. One definition now; do not
// reintroduce a local copy.

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const user = session.user as any
    if (user.role !== 'consumer') {
      return NextResponse.json({ error: 'Consumer access only' }, { status: 403 })
    }
    const consumerId: string = user.id

    // EV.1 hard-block — redeeming points is a financial action.
    try {
      await requireEmailVerified(consumerId)
    } catch (err) {
      if (err instanceof EmailNotVerifiedError) {
        return NextResponse.json(emailNotVerifiedResponseBody(), { status: 403 })
      }
      throw err
    }

    // ── Parse body ────────────────────────────────────────────────
    const body = await req.json().catch(() => null)
    if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

    const { points, redemptionType, payoutAccountId } = body

    if (!points || typeof points !== 'number' || !Number.isInteger(points) || points <= 0) {
      return NextResponse.json({ error: 'points must be a positive integer' }, { status: 400 })
    }
    if (!redemptionType || !['platform_credits', 'voucher', 'cash_payout'].includes(redemptionType)) {
      return NextResponse.json(
        { error: 'redemptionType must be platform_credits, voucher, or cash_payout' },
        { status: 400 }
      )
    }

    // ── Minimum threshold ─────────────────────────────────────────
    if (points < MINIMUM_REDEMPTION_POINTS) {
      return NextResponse.json(
        { error: `Minimum redemption is ${MINIMUM_REDEMPTION_POINTS} points` },
        { status: 400 }
      )
    }

    // ── Cash payout requires account ──────────────────────────────
    if (redemptionType === 'cash_payout' && !payoutAccountId) {
      return NextResponse.json(
        { error: 'payoutAccountId is required for cash payout' },
        { status: 400 }
      )
    }

    // ── Duplicate check — one pending redemption at a time ─────────
    // Check this BEFORE deducting points to avoid deducting then failing
    const pending = await getPendingRedemptions()
    const hasPending = pending.some((r) => r.consumerId === consumerId)
    if (hasPending) {
      return NextResponse.json(
        { error: 'You already have a pending redemption. Wait for it to complete before creating a new one.' },
        { status: 409 }
      )
    }

    // ── Check balance ─────────────────────────────────────────────
    const balance = await getUserBalance(consumerId)
    if (balance < points) {
      return NextResponse.json(
        { error: `Insufficient points. You have ${balance} points, requested ${points}.` },
        { status: 400 }
      )
    }

    // ── Calculate value in paise ──────────────────────────────────
    // Exact integer math: 1 point = 10 paise. The old
    // `Math.round(points / POINTS_PER_INR) * 100` rounded to whole rupees first,
    // over/under-paying up to 50 paise on points not divisible by 10 (B14).
    const valueInPaise = points * PAISE_PER_POINT

    // ── Validate payout account for cash redemptions ──────────────
    if (redemptionType === 'cash_payout' && payoutAccountId) {
      const account = await getAccountById(payoutAccountId, consumerId)
      if (!account) {
        return NextResponse.json({ error: 'Payout account not found' }, { status: 404 })
      }
    }

    // ── Deduct points AND record the redemption in ONE transaction ──
    //
    // ⚠️ These were two independent writes. deductPoints was internally
    // transactional, so the deduction committed on its own — and if
    // createRedemption then threw, the catch below returned a 500 with the
    // points already gone and NOTHING recording what the user redeemed. The
    // user sees an error, their balance is lower, and there is no row to
    // reconcile against or refund from.
    //
    // Both now share one commit boundary: either the balance moves and the
    // record exists, or neither happened.
    //
    // ⚠️ insufficientBalance is returned as a VALUE rather than thrown. A
    // throw would roll back correctly but land in the generic catch as a 500,
    // turning "you don't have enough points" into "the server broke".
    // ⚠️ The result is RETURNED from the transaction rather than assigned to an
    // outer `let`. TypeScript's control-flow analysis does not track
    // assignments made inside a closure, so a `let redemption: T | null = null`
    // written to in the callback still reads as `null` afterwards and any
    // property access on it is an error on type `never`. Returning the value
    // keeps the narrowing honest and removes the mutable outer state.
    const outcome = await db.transaction(async (tx) => {
      const deducted = await deductPoints(
        consumerId,
        points,
        'reward_redemption',
        undefined,
        `Redeemed ${points} points for ${redemptionType}`,
        tx,
      )
      if (!deducted) return { insufficientBalance: true as const, redemption: null }

      const created = await createRedemption({
        consumerId,
        points,
        value: valueInPaise,
        currency: 'INR',
        redemptionType: redemptionType as any,
        status: 'pending',
        payoutId: null,
        voucherCode: null,
        brandId: null,
        failureReason: null,
        processedAt: null,
        adminNote: null,
      }, tx)

      return { insufficientBalance: false as const, redemption: created }
    })

    if (outcome.insufficientBalance || !outcome.redemption) {
      return NextResponse.json({ error: 'Failed to deduct points — insufficient balance' }, { status: 400 })
    }
    const redemption = outcome.redemption

    // ── For cash payout: create payout record ─────────────────────
    let payoutId: string | undefined
    if (redemptionType === 'cash_payout' && payoutAccountId) {
      try {
        const payout = await initiateRecipientPayout({
          recipientId: consumerId,
          recipientType: 'consumer',
          amount: valueInPaise,
          currency: 'INR',
        })
        payoutId = payout.payoutId
      } catch (payoutError) {
        // Redemption record exists but payout failed — log and continue
        // Admin will see the redemption in queue and can manually process
        console.error('[RewardsRedeem] Payout creation failed after redemption:', payoutError)
      }
    }

    // ── For platform_credits: instant completion ──────────────────
    const finalStatus = redemptionType === 'platform_credits' ? 'completed' : 'pending'

    // Emit reward redeemed event (non-fatal)
    await emit(PLATFORM_EVENTS.CONSUMER_REWARD_REDEEMED, {
      actorId: consumerId,
      actorRole: 'consumer',
      redemptionType,
      points,
      value: valueInPaise,
      currency: 'INR',
    }).catch(() => {})

    return NextResponse.json({
      success: true,
      redemptionId: redemption.id,
      points,
      value: valueInPaise,
      currency: 'INR',
      redemptionType,
      status: finalStatus,
      payoutId,
    }, { status: 201 })
  } catch (error) {
    console.error('[RewardsRedeem POST]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
