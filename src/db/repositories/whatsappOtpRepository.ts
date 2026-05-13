import 'server-only'

import { db } from '@/db'
import {
  whatsappOtpVerifications,
  type WhatsappOtpVerification,
  type NewWhatsappOtpVerification,
} from '@/db/schema'
import { and, desc, eq, gt, isNotNull, isNull, sql } from 'drizzle-orm'

export async function createOtp(
  data: Omit<NewWhatsappOtpVerification, 'id' | 'createdAt' | 'verifiedAt' | 'attempts' | 'maxAttempts'>
    & Partial<Pick<NewWhatsappOtpVerification, 'maxAttempts'>>
): Promise<WhatsappOtpVerification> {
  const [row] = await db.insert(whatsappOtpVerifications).values(data).returning()
  return row
}

/**
 * Most recent unverified, unexpired OTP for the (userId, phoneNumber) pair.
 * Returns null if none exists.
 */
export async function findActiveOtp(
  userId: string,
  phoneNumber: string
): Promise<WhatsappOtpVerification | null> {
  const now = new Date()
  const rows = await db
    .select()
    .from(whatsappOtpVerifications)
    .where(
      and(
        eq(whatsappOtpVerifications.userId, userId),
        eq(whatsappOtpVerifications.phoneNumber, phoneNumber),
        isNull(whatsappOtpVerifications.verifiedAt),
        gt(whatsappOtpVerifications.expiresAt, now)
      )
    )
    .orderBy(desc(whatsappOtpVerifications.createdAt))
    .limit(1)
  return rows[0] ?? null
}

export async function incrementAttempts(id: string): Promise<void> {
  await db
    .update(whatsappOtpVerifications)
    .set({ attempts: sql`${whatsappOtpVerifications.attempts} + 1` })
    .where(eq(whatsappOtpVerifications.id, id))
}

export async function markVerified(id: string): Promise<void> {
  await db
    .update(whatsappOtpVerifications)
    .set({ verifiedAt: new Date() })
    .where(eq(whatsappOtpVerifications.id, id))
}

/**
 * True if any row exists for (userId, phoneNumber) with verified_at IS NOT NULL.
 * Once a phone is verified for a user, it stays verified — proves possession
 * at some point. Re-verification is only required when the number changes.
 */
export async function hasVerifiedPhone(
  userId: string,
  phoneNumber: string
): Promise<boolean> {
  const rows = await db
    .select({ id: whatsappOtpVerifications.id })
    .from(whatsappOtpVerifications)
    .where(
      and(
        eq(whatsappOtpVerifications.userId, userId),
        eq(whatsappOtpVerifications.phoneNumber, phoneNumber),
        isNotNull(whatsappOtpVerifications.verifiedAt)
      )
    )
    .limit(1)
  return rows.length > 0
}
