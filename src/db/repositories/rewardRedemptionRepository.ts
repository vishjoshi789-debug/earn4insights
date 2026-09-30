import 'server-only'

/**
 * ⚠️⚠️ THIS FILE WRITES `payment_redemptions`. NOT `reward_redemptions`.
 *
 * The filename is wrong and has cost real investigation time **three separate
 * times** — most recently while answering "has a `db.transaction()` ever
 * committed on the pooler?", where `reward_redemptions` showing **0 rows ever**
 * looked like proof that the redemption transaction had never run. It was not:
 * the 2026-08-23 row lives in `payment_redemptions`, which is what this
 * repository actually touches.
 *
 * ── THE TWO TABLES ARE BOTH REAL AND BOTH LIVE ────────────────────────────
 *
 *   `payment_redemptions`   — cash payout / voucher redemptions.
 *                             Written HERE, via `api/consumer/rewards/redeem`.
 *                             1 row (2026-08-23).
 *
 *   `reward_redemptions`    — catalog rewards (spend points on an item).
 *                             Written by `api/rewards/route.ts:120`, read by
 *                             the same route at :27-35. **0 rows — unused, NOT
 *                             unwired.**
 *
 * 🔴 **DO NOT DROP `reward_redemptions`.** It has a live reader and a live
 * writer; dropping it breaks the rewards catalog redemption path. "Zero rows"
 * means nobody has redeemed a catalog reward yet, not that nothing can.
 *
 * ⚠️ `updateRedemptionStatus` below is NOT uncalled — `payoutService.ts` calls
 * it at :366 and :425. The "had zero callers" note at `payoutService.ts:346` is
 * a historical remark from when that circuit was wired up, and reads as current
 * if skimmed.
 *
 * Renaming this file to `paymentRedemptionRepository.ts` is the real fix.
 */

import { db } from '@/db'
import {
  paymentRedemptions,
  type PaymentRedemption,
  type NewPaymentRedemption,
} from '@/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import type { DbTx } from '@/db/tx'

// ── Create ───────────────────────────────────────────────────────

export async function createRedemption(
  data: Omit<NewPaymentRedemption, 'id' | 'createdAt' | 'updatedAt'>,
  /**
   * ⚠️ Pass the caller's transaction so this row and the points deduction
   * commit together. Without it they are two independent writes: the points
   * leave the balance, this insert fails, and there is no record of what the
   * user redeemed — a silent loss the user only sees as a 500.
   */
  tx?: DbTx,
): Promise<PaymentRedemption> {
  const [row] = await (tx ?? db)
    .insert(paymentRedemptions)
    .values(data)
    .returning()
  return row
}

// ── Read ─────────────────────────────────────────────────────────

export async function getRedemptionById(id: string): Promise<PaymentRedemption | null> {
  const rows = await db
    .select()
    .from(paymentRedemptions)
    .where(eq(paymentRedemptions.id, id))
    .limit(1)
  return rows[0] ?? null
}

export async function getRedemptionsForConsumer(
  consumerId: string
): Promise<PaymentRedemption[]> {
  return db
    .select()
    .from(paymentRedemptions)
    .where(eq(paymentRedemptions.consumerId, consumerId))
    .orderBy(desc(paymentRedemptions.createdAt))
}

/**
 * The redemption a payout was created to satisfy, if any.
 *
 * A consumer cash redemption writes TWO rows — this one and an
 * `influencer_payouts` row linked by `payout_id`. Completing the payout
 * without closing this row is the drift that left a paid redemption reading
 * 'pending' forever. Returns null for campaign/influencer payouts, which have
 * no redemption behind them — a normal case, not an error.
 */
export async function getRedemptionByPayoutId(
  payoutId: string,
  tx?: DbTx,
): Promise<PaymentRedemption | null> {
  const rows = await (tx ?? db)
    .select()
    .from(paymentRedemptions)
    .where(eq(paymentRedemptions.payoutId, payoutId))
    .limit(1)
  return rows[0] ?? null
}

export async function getPendingRedemptions(): Promise<PaymentRedemption[]> {
  return db
    .select()
    .from(paymentRedemptions)
    .where(eq(paymentRedemptions.status, 'pending'))
    .orderBy(paymentRedemptions.createdAt)
}

// ── Update ───────────────────────────────────────────────────────

export async function updateRedemptionStatus(
  id: string,
  updates: Partial<Pick<
    PaymentRedemption,
    'status' | 'payoutId' | 'voucherCode' | 'failureReason' |
    'processedAt' | 'adminNote'
  >>,
  /** Pass the caller's transaction so this lands with the payout it mirrors. */
  tx?: DbTx,
): Promise<PaymentRedemption> {
  const [updated] = await (tx ?? db)
    .update(paymentRedemptions)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(paymentRedemptions.id, id))
    .returning()

  if (!updated) throw new Error(`Redemption not found: ${id}`)
  return updated
}
