import 'server-only'

import { randomInt } from 'crypto'
import bcrypt from 'bcryptjs'
import {
  createOtp,
  findActiveOtp,
  incrementAttempts,
  markVerified,
  hasVerifiedPhone as repoHasVerifiedPhone,
} from '@/db/repositories/whatsappOtpRepository'
import { sendWhatsAppAlertMessage } from '@/server/whatsappNotifications'

const OTP_TTL_MS = 15 * 60 * 1000 // 15 minutes
const MAX_ATTEMPTS = 3

export class WhatsappOtpError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message)
    this.name = 'WhatsappOtpError'
  }
}

/**
 * Generate a 6-digit OTP, store its bcrypt hash with a 15-minute TTL, and
 * deliver it to the supplied WhatsApp phone number via Twilio. Throws
 * WhatsappOtpError on delivery failure.
 */
export async function sendOtp(userId: string, phoneNumber: string): Promise<void> {
  const otp = String(randomInt(100000, 999999))
  const otpHash = await bcrypt.hash(otp, 10)
  const expiresAt = new Date(Date.now() + OTP_TTL_MS)

  await createOtp({
    userId,
    phoneNumber,
    otpHash,
    expiresAt,
  })

  const result = await sendWhatsAppAlertMessage({
    phoneNumber,
    title: 'Verify your WhatsApp number',
    body:
      `Your Earn4Insights verification code is: *${otp}*\n\n` +
      `This code expires in 15 minutes. If you didn't request this, ignore this message.`,
  })

  if (!result.success) {
    throw new WhatsappOtpError(
      'Failed to deliver OTP via WhatsApp. Confirm the number is correct and try again.',
      'delivery_failed'
    )
  }
}

/**
 * Verify a 6-digit OTP against the most recent unexpired OTP record. On
 * success, marks verified_at. On failure, increments attempts and surfaces
 * the failure reason so the UI can show "X attempts remaining".
 */
export async function verifyOtp(
  userId: string,
  phoneNumber: string,
  otp: string
): Promise<{ success: true } | { success: false; reason: 'no_active_otp' | 'too_many_attempts' | 'invalid_otp'; attemptsRemaining?: number }> {
  if (!/^\d{6}$/.test(otp)) {
    return { success: false, reason: 'invalid_otp', attemptsRemaining: undefined }
  }

  const record = await findActiveOtp(userId, phoneNumber)
  if (!record) {
    return { success: false, reason: 'no_active_otp' }
  }

  if (record.attempts >= record.maxAttempts) {
    return { success: false, reason: 'too_many_attempts' }
  }

  const matches = await bcrypt.compare(otp, record.otpHash)
  if (!matches) {
    await incrementAttempts(record.id)
    const attemptsRemaining = Math.max(0, record.maxAttempts - record.attempts - 1)
    return { success: false, reason: 'invalid_otp', attemptsRemaining }
  }

  await markVerified(record.id)
  return { success: true }
}

/**
 * Has the (userId, phoneNumber) pair ever been verified? Used to gate the
 * notification-settings save endpoint — saving a new phone is only allowed
 * after verification.
 */
export async function hasVerifiedPhone(userId: string, phoneNumber: string): Promise<boolean> {
  return repoHasVerifiedPhone(userId, phoneNumber)
}

export const WHATSAPP_OTP_TTL_MS = OTP_TTL_MS
export const WHATSAPP_OTP_MAX_ATTEMPTS = MAX_ATTEMPTS
