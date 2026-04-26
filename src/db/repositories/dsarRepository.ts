import 'server-only'

import { db } from '@/db'
import { dsarRequests, type DsarRequest, type NewDsarRequest } from '@/db/schema'
import { eq, and, desc, lt, or } from 'drizzle-orm'
import { sql } from 'drizzle-orm'

export async function createDsarRequest(
  data: Omit<NewDsarRequest, 'id' | 'createdAt' | 'updatedAt'>
): Promise<DsarRequest> {
  const [row] = await db
    .insert(dsarRequests)
    .values({ ...data, updatedAt: new Date() })
    .returning()
  return row
}

export async function findDsarById(id: string): Promise<DsarRequest | null> {
  const rows = await db
    .select()
    .from(dsarRequests)
    .where(eq(dsarRequests.id, id))
    .limit(1)
  return rows[0] ?? null
}

export async function findLatestDsarByConsumer(consumerId: string): Promise<DsarRequest | null> {
  const rows = await db
    .select()
    .from(dsarRequests)
    .where(eq(dsarRequests.consumerId, consumerId))
    .orderBy(desc(dsarRequests.createdAt))
    .limit(1)
  return rows[0] ?? null
}

export async function updateDsarRequest(
  id: string,
  data: Partial<Omit<NewDsarRequest, 'id' | 'createdAt'>>
): Promise<DsarRequest> {
  const [row] = await db
    .update(dsarRequests)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(dsarRequests.id, id))
    .returning()
  return row
}

/** Find all completed requests whose PDF download link has expired and not yet marked expired. */
export async function findExpiredCompletedRequests(): Promise<DsarRequest[]> {
  const now = new Date()
  return db
    .select()
    .from(dsarRequests)
    .where(
      and(
        eq(dsarRequests.status, 'completed'),
        lt(dsarRequests.expiresAt, now)
      )
    )
}

/** Find stale otp_sent requests where OTP expired more than 1 hour ago. */
export async function findStaleOtpRequests(): Promise<DsarRequest[]> {
  const cutoff = new Date(Date.now() - 60 * 60 * 1000)
  return db
    .select()
    .from(dsarRequests)
    .where(
      and(
        eq(dsarRequests.status, 'otp_sent'),
        lt(dsarRequests.otpExpiresAt, cutoff)
      )
    )
}
