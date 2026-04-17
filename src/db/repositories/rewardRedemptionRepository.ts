import 'server-only'

import { db } from '@/db'
import {
  paymentRedemptions,
  type PaymentRedemption,
  type NewPaymentRedemption,
} from '@/db/schema'
import { eq, and, desc } from 'drizzle-orm'

// ── Create ───────────────────────────────────────────────────────

export async function createRedemption(
  data: Omit<NewPaymentRedemption, 'id' | 'createdAt' | 'updatedAt'>
): Promise<PaymentRedemption> {
  const [row] = await db
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
  >>
): Promise<PaymentRedemption> {
  const [updated] = await db
    .update(paymentRedemptions)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(paymentRedemptions.id, id))
    .returning()

  if (!updated) throw new Error(`Redemption not found: ${id}`)
  return updated
}
