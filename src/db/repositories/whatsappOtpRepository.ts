import 'server-only'

import { db } from '@/db'
import { whatsappOtpVerifications } from '@/db/schema'
import { and, eq, isNotNull } from 'drizzle-orm'

/**
 * Persistence for WhatsApp phone verification.
 *
 * Twilio Verify owns the OTP lifecycle (generation, delivery, expiry,
 * attempt limits), so this table no longer stores codes. It holds only
 * verified-phone markers: one row per (userId, phoneNumber) pair that has
 * passed verification. `otp_hash` / `expires_at` are nullable and unused
 * (migration 018).
 */

/**
 * Record that (userId, phoneNumber) passed WhatsApp OTP verification.
 * Idempotent — a no-op if the pair is already marked verified.
 */
export async function recordVerifiedPhone(
  userId: string,
  phoneNumber: string
): Promise<void> {
  if (await hasVerifiedPhone(userId, phoneNumber)) return
  await db.insert(whatsappOtpVerifications).values({
    userId,
    phoneNumber,
    verifiedAt: new Date(),
  })
}

/**
 * True if any row exists for (userId, phoneNumber) with verified_at IS NOT NULL.
 * Once a phone is verified for a user it stays verified — possession was
 * proven. Re-verification is only required when the number changes.
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
