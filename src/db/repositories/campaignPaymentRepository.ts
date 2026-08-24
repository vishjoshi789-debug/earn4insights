import 'server-only'

import { db } from '@/db'
import {
  campaignPayments,
  type CampaignPayment,
  type NewCampaignPayment,
} from '@/db/schema'
import { eq, and, desc, sql } from 'drizzle-orm'

// ── Create ───────────────────────────────────────────────────────

export async function createPayment(
  data: Omit<NewCampaignPayment, 'id' | 'createdAt' | 'updatedAt'>
): Promise<CampaignPayment> {
  const [row] = await db
    .insert(campaignPayments)
    .values(data)
    .returning()
  return row
}

// ── Read ─────────────────────────────────────────────────────────

export async function getPaymentById(id: string): Promise<CampaignPayment | null> {
  const rows = await db
    .select()
    .from(campaignPayments)
    .where(eq(campaignPayments.id, id))
    .limit(1)
  return rows[0] ?? null
}

export async function getPaymentsByCampaign(campaignId: string): Promise<CampaignPayment[]> {
  return db
    .select()
    .from(campaignPayments)
    .where(eq(campaignPayments.campaignId, campaignId))
    .orderBy(desc(campaignPayments.createdAt))
}

export async function getPaymentByMilestone(milestoneId: string): Promise<CampaignPayment | null> {
  const rows = await db
    .select()
    .from(campaignPayments)
    .where(eq(campaignPayments.milestoneId, milestoneId))
    .limit(1)
  return rows[0] ?? null
}

/**
 * Look up the ledger row for a Razorpay order.
 *
 * This is the lookup the capture + webhook paths need. Both previously reached
 * the ledger via `getPaymentByMilestone`, wrapped in `if (order.milestoneId)`,
 * which made a campaign-level payment (milestone_id NULL) invisible to them —
 * the ledger gap, confirmed on a real payment 2026-08-20.
 */
export async function getPaymentByRazorpayOrderId(
  razorpayOrderId: string,
): Promise<CampaignPayment | null> {
  const rows = await db
    .select()
    .from(campaignPayments)
    .where(eq(campaignPayments.razorpayOrderId, razorpayOrderId))
    .limit(1)
  return rows[0] ?? null
}

/**
 * Conditional claim: flip a ledger row to 'escrowed' ONLY if it is still
 * 'pending'. Returns the row when THIS caller won the flip, null otherwise.
 *
 * ⚠️ Read-then-write is wrong here and the guard is the whole point. Capture
 * (the browser returning from checkout) and the Razorpay webhook race each
 * other by design — both are meant to fire, and either may arrive first. A
 * `SELECT status` followed by an `UPDATE` lets both observe 'pending' and both
 * write, double-counting the money. The `WHERE status='pending'` makes the
 * database arbitrate, so exactly one caller ever sees the transition.
 *
 * Same shape as claimResolutionNotification (v16) and the scheduled-launch
 * cron guard. Do not "simplify" it into a status read.
 */
export async function claimPaymentEscrowed(
  id: string,
  extra: { razorpayOrderId?: string; razorpayPaymentId?: string },
): Promise<CampaignPayment | null> {
  const [claimed] = await db
    .update(campaignPayments)
    .set({
      status: 'escrowed',
      escrowedAt: new Date(),
      ...extra,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(campaignPayments.id, id),
        eq(campaignPayments.status, 'pending'),
      ),
    )
    .returning()
  return claimed ?? null
}

export async function getTotalPaidForCampaign(campaignId: string): Promise<number> {
  const [row] = await db
    .select({ total: sql<number>`COALESCE(SUM(${campaignPayments.amount}), 0)` })
    .from(campaignPayments)
    .where(
      and(
        eq(campaignPayments.campaignId, campaignId),
        eq(campaignPayments.status, 'released')
      )
    )
  return Number(row?.total ?? 0)
}

export async function getTotalEscrowedForCampaign(campaignId: string): Promise<number> {
  const [row] = await db
    .select({ total: sql<number>`COALESCE(SUM(${campaignPayments.amount}), 0)` })
    .from(campaignPayments)
    .where(
      and(
        eq(campaignPayments.campaignId, campaignId),
        eq(campaignPayments.status, 'escrowed')
      )
    )
  return Number(row?.total ?? 0)
}

// ── Update ───────────────────────────────────────────────────────

export async function updatePaymentStatus(
  id: string,
  status: string,
  extra?: {
    razorpayOrderId?: string
    razorpayPaymentId?: string
    razorpayTransferId?: string
    escrowedAt?: Date
    releasedAt?: Date
    refundedAt?: Date
    failureReason?: string
  }
): Promise<CampaignPayment> {
  const [updated] = await db
    .update(campaignPayments)
    .set({
      status: status as any,
      ...extra,
      updatedAt: new Date(),
    })
    .where(eq(campaignPayments.id, id))
    .returning()

  if (!updated) throw new Error(`Payment not found: ${id}`)
  return updated
}
