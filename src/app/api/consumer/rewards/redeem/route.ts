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
import { getUserBalance, deductPoints, POINTS_PER_DOLLAR } from '@/server/pointsService'
import {
  createRedemption,
  getPendingRedemptions,
} from '@/db/repositories/rewardRedemptionRepository'
import { getAccountById } from '@/db/repositories/payoutAccountRepository'
import { initiateRecipientPayout, PayoutAccountMissingError } from '@/server/payoutService'
import { convertToMinor } from '@/lib/currency'
import { emit, PLATFORM_EVENTS } from '@/server/eventBus'

const MINIMUM_REDEMPTION_POINTS = 500
// 10 points = ₹1 (₹0.10 per point — matches UI POINTS_TO_INR = 0.10)
const POINTS_PER_INR = 10

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
    const valueInPaise = Math.round(points / POINTS_PER_INR) * 100 // points → rupees → paise

    // ── Validate payout account for cash redemptions ──────────────
    if (redemptionType === 'cash_payout' && payoutAccountId) {
      const account = await getAccountById(payoutAccountId, consumerId)
      if (!account) {
        return NextResponse.json({ error: 'Payout account not found' }, { status: 404 })
      }
    }

    // ── Deduct points (atomic balance check inside deductPoints) ──
    const deducted = await deductPoints(
      consumerId,
      points,
      'reward_redemption',
      undefined,
      `Redeemed ${points} points for ${redemptionType}`
    )
    if (!deducted) {
      return NextResponse.json({ error: 'Failed to deduct points — insufficient balance' }, { status: 400 })
    }

    // ── Create redemption record ──────────────────────────────────
    const redemption = await createRedemption({
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
    })

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
