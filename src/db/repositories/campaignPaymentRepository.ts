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
