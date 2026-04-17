import 'server-only'

import { db } from '@/db'
import {
  razorpayOrders,
  influencerPayouts,
  type RazorpayOrder,
  type NewRazorpayOrder,
  type InfluencerPayout,
  type NewInfluencerPayout,
} from '@/db/schema'
import { eq, and, desc, sql, lt } from 'drizzle-orm'

// ═══════════════════════════════════════════════════════════════════
// RAZORPAY ORDERS
// ═══════════════════════════════════════════════════════════════════

export async function createOrder(
  data: Omit<NewRazorpayOrder, 'id' | 'createdAt' | 'updatedAt'>
): Promise<RazorpayOrder> {
  const [row] = await db
    .insert(razorpayOrders)
    .values(data)
    .returning()
  return row
}

export async function getOrderByRazorpayId(
  razorpayOrderId: string
): Promise<RazorpayOrder | null> {
  const rows = await db
    .select()
    .from(razorpayOrders)
    .where(eq(razorpayOrders.razorpayOrderId, razorpayOrderId))
    .limit(1)
  return rows[0] ?? null
}

export async function getOrdersByCampaign(
  campaignId: string
): Promise<RazorpayOrder[]> {
  return db
    .select()
    .from(razorpayOrders)
    .where(eq(razorpayOrders.campaignId, campaignId))
    .orderBy(desc(razorpayOrders.createdAt))
}

export async function updateOrderStatus(
  razorpayOrderId: string,
  updates: Partial<Pick<
    RazorpayOrder,
    'status' | 'razorpayPaymentId' | 'razorpaySignature' |
    'paymentMethod' | 'refundAmount' | 'refundId' | 'refundedAt'
  >>
): Promise<RazorpayOrder> {
  const [updated] = await db
    .update(razorpayOrders)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(razorpayOrders.razorpayOrderId, razorpayOrderId))
    .returning()

  if (!updated) throw new Error(`Razorpay order not found: ${razorpayOrderId}`)
  return updated
}

// ═══════════════════════════════════════════════════════════════════
// INFLUENCER / CONSUMER PAYOUTS
// ═══════════════════════════════════════════════════════════════════

export async function createPayout(
  data: Omit<NewInfluencerPayout, 'id' | 'createdAt' | 'updatedAt'>
): Promise<InfluencerPayout> {
  const [row] = await db
    .insert(influencerPayouts)
    .values(data)
    .returning()
  return row
}

export async function getPayoutById(id: string): Promise<InfluencerPayout | null> {
  const rows = await db
    .select()
    .from(influencerPayouts)
    .where(eq(influencerPayouts.id, id))
    .limit(1)
  return rows[0] ?? null
}

export async function updatePayoutStatus(
  id: string,
  updates: Partial<Pick<
    InfluencerPayout,
    'status' | 'razorpayPayoutId' | 'wiseTransferId' |
    'failureReason' | 'retryCount' | 'initiatedAt' |
    'completedAt' | 'adminNote' | 'processedBy'
  >>
): Promise<InfluencerPayout> {
  const [updated] = await db
    .update(influencerPayouts)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(influencerPayouts.id, id))
    .returning()

  if (!updated) throw new Error(`Payout not found: ${id}`)
  return updated
}

export async function getPendingPayouts(
  recipientType?: 'influencer' | 'consumer'
): Promise<InfluencerPayout[]> {
  const conditions = [eq(influencerPayouts.status, 'pending')]
  if (recipientType) {
    conditions.push(eq(influencerPayouts.recipientType, recipientType))
  }
  return db
    .select()
    .from(influencerPayouts)
    .where(and(...conditions))
    .orderBy(desc(influencerPayouts.createdAt))
}

export async function getPayoutsForRecipient(
  recipientId: string,
  filters?: {
    status?: string
    from?: Date
    to?: Date
    limit?: number
    offset?: number
  }
): Promise<InfluencerPayout[]> {
  const conditions = [eq(influencerPayouts.recipientId, recipientId)]
  if (filters?.status) {
    conditions.push(eq(influencerPayouts.status, filters.status as any))
  }
  if (filters?.from) {
    conditions.push(sql`${influencerPayouts.createdAt} >= ${filters.from}`)
  }
  if (filters?.to) {
    conditions.push(sql`${influencerPayouts.createdAt} <= ${filters.to}`)
  }

  return db
    .select()
    .from(influencerPayouts)
    .where(and(...conditions))
    .orderBy(desc(influencerPayouts.createdAt))
    .limit(filters?.limit ?? 50)
    .offset(filters?.offset ?? 0)
}

/**
 * Find payouts in 'processing' status older than the given date.
 * Used by sync-razorpay-status cron to poll for updates.
 */
export async function getProcessingPayoutsOlderThan(
  olderThan: Date
): Promise<InfluencerPayout[]> {
  return db
    .select()
    .from(influencerPayouts)
    .where(
      and(
        eq(influencerPayouts.status, 'processing'),
        lt(influencerPayouts.updatedAt, olderThan)
      )
    )
    .orderBy(influencerPayouts.createdAt)
}

/**
 * Get all payouts for admin queue (pending + processing + failed).
 */
export async function getAdminPayoutQueue(): Promise<InfluencerPayout[]> {
  return db
    .select()
    .from(influencerPayouts)
    .where(
      sql`${influencerPayouts.status} IN ('pending', 'processing', 'failed')`
    )
    .orderBy(influencerPayouts.createdAt)
}
