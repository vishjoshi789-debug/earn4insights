import 'server-only'

import twilio from 'twilio'
import {
  recordVerifiedPhone,
  hasVerifiedPhone as repoHasVerifiedPhone,
} from '@/db/repositories/whatsappOtpRepository'
import { logger } from '@/lib/logger'

/**
 * Phone-number verification via Twilio Verify.
 *
 * Twilio Verify owns OTP generation, delivery, expiry, and attempt limits.
 * The delivery channel is set by TWILIO_VERIFY_CHANNEL — 'sms' by default,
 * 'whatsapp' once a Twilio WhatsApp sender is approved. Switching channels
 * is an env-var change only, no code change.
 *
 * We persist nothing about the OTP itself. The only thing recorded locally
 * is the *fact* that a (userId, phoneNumber) pair passed verification —
 * `whatsappOtpVerifications` now holds verified-phone markers, used to gate
 * saving a number to notification settings (see `hasVerifiedPhone`).
 */

const twilioClient =
  process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
    ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
    : null

const VERIFY_SERVICE_SID = process.env.TWILIO_VERIFY_SERVICE_SID

// Delivery channel for the verification code. 'sms' now; flip the env var
// to 'whatsapp' once the Twilio WhatsApp sender is approved — no code change.
const VERIFY_CHANNEL = process.env.TWILIO_VERIFY_CHANNEL === 'whatsapp' ? 'whatsapp' : 'sms'

export class WhatsappOtpError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message)
    this.name = 'WhatsappOtpError'
  }
}

function isConfigured(): boolean {
  return Boolean(twilioClient && VERIFY_SERVICE_SID)
}

/**
 * Start a WhatsApp OTP verification for `phoneNumber` (E.164). Twilio
 * generates and delivers the code. Resolves on a successful send; throws
 * WhatsappOtpError on a config or delivery failure.
 */
export async function sendOtp(phoneNumber: string): Promise<void> {
  if (!isConfigured()) {
    logger.serviceError('twilio-verify', 'sendOtp', 'TWILIO_VERIFY_SERVICE_SID not configured')
    throw new WhatsappOtpError(
      'Phone verification is temporarily unavailable. Please try again later.',
      'not_configured'
    )
  }

  try {
    const verification = await twilioClient!.verify.v2
      .services(VERIFY_SERVICE_SID!)
      .verifications.create({ to: phoneNumber, channel: VERIFY_CHANNEL })

    // A successful send leaves the verification in 'pending'.
    if (verification.status !== 'pending') {
      throw new WhatsappOtpError(
        'Could not send the verification code. Please try again.',
        'send_failed'
      )
    }
  } catch (err) {
    if (err instanceof WhatsappOtpError) throw err
    logger.serviceError('twilio-verify', 'sendOtp', err, { phoneNumber })

    const code = (err as { code?: number }).code
    if (code === 60200) {
      throw new WhatsappOtpError(
        'That phone number is not valid. Check the country code and try again.',
        'invalid_number'
      )
    }
    if (code === 60203) {
      throw new WhatsappOtpError(
        'Too many code requests for this number. Please wait a few minutes and try again.',
        'max_send_attempts'
      )
    }
    throw new WhatsappOtpError(
      'Failed to send the verification code. Please try again.',
      'delivery_failed'
    )
  }
}

/**
 * Check a 6-digit code against the active Twilio verification. On approval,
 * records the (userId, phoneNumber) pair as verified and returns success.
 * Never throws — returns a tagged failure the route maps to a 4xx body.
 *
 *  - `invalid_otp`   → wrong code; the user can retry with the same code request.
 *  - `no_active_otp` → expired, already used, or attempt limit hit; request a new code.
 */
export async function verifyOtp(
  userId: string,
  phoneNumber: string,
  otp: string
): Promise<
  | { success: true }
  | { success: false; reason: 'no_active_otp' | 'invalid_otp' }
> {
  if (!/^\d{6}$/.test(otp)) {
    return { success: false, reason: 'invalid_otp' }
  }
  if (!isConfigured()) {
    logger.serviceError('twilio-verify', 'verifyOtp', 'TWILIO_VERIFY_SERVICE_SID not configured')
    return { success: false, reason: 'no_active_otp' }
  }

  try {
    const check = await twilioClient!.verify.v2
      .services(VERIFY_SERVICE_SID!)
      .verificationChecks.create({ to: phoneNumber, code: otp })

    if (check.status === 'approved') {
      try {
        await recordVerifiedPhone(userId, phoneNumber)
      } catch (err) {
        // Non-fatal: Twilio approved the code, so verification did succeed.
        // A DB failure here only blocks the later notification-settings save
        // (the hasVerifiedPhone gate) — not worth turning a verified code
        // into a 500. Most likely cause: migration 018 has not been run.
        logger.serviceError('twilio-verify', 'recordVerifiedPhone', err, { phoneNumber })
      }
      return { success: true }
    }
    // 'pending'  → wrong code, still retryable
    // 'canceled' → verification consumed/cancelled — need a fresh code
    return {
      success: false,
      reason: check.status === 'canceled' ? 'no_active_otp' : 'invalid_otp',
    }
  } catch (err) {
    // Twilio returns 404 once a verification is approved, expired, or has
    // exceeded its check-attempt limit — there is nothing left to check.
    if ((err as { status?: number }).status === 404) {
      return { success: false, reason: 'no_active_otp' }
    }
    logger.serviceError('twilio-verify', 'verifyOtp', err, { phoneNumber })
    return { success: false, reason: 'invalid_otp' }
  }
}

/**
 * Has the (userId, phoneNumber) pair ever passed verification? Gates the
 * notification-settings save endpoint — a number can only be saved after
 * its owner has proven possession at least once.
 */
export async function hasVerifiedPhone(userId: string, phoneNumber: string): Promise<boolean> {
  return repoHasVerifiedPhone(userId, phoneNumber)
}
