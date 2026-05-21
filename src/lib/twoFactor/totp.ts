import 'server-only'

import * as OTPAuth from 'otpauth'
import QRCode from 'qrcode'

/**
 * TOTP primitives (RFC 6238) for two-factor authentication.
 *
 * Wraps the `otpauth` library so the rest of the codebase never touches
 * it directly. Compatible with Google Authenticator, Authy, 1Password,
 * and Microsoft Authenticator (standard SHA-1 / 6-digit / 30-second TOTP).
 */

const ISSUER = 'Earn4Insights'

/** Generate a fresh 160-bit (20-byte) base32 TOTP secret. */
export function generateTotpSecret(): string {
  return new OTPAuth.Secret({ size: 20 }).base32
}

function buildTotp(secretBase32: string, label: string): OTPAuth.TOTP {
  return new OTPAuth.TOTP({
    issuer: ISSUER,
    label,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secretBase32),
  })
}

/**
 * Build the otpauth:// URI an authenticator app scans. Format:
 * `otpauth://totp/Earn4Insights:<email>?secret=...&issuer=Earn4Insights`
 */
export function buildOtpAuthUri(secretBase32: string, accountLabel: string): string {
  return buildTotp(secretBase32, accountLabel).toString()
}

/** Render an otpauth:// URI as a PNG data-URL for the setup screen. */
export async function buildQrCodeDataUrl(otpauthUri: string): Promise<string> {
  return QRCode.toDataURL(otpauthUri, { width: 240, margin: 1 })
}

/**
 * Validate a 6-digit TOTP code against the secret. Accepts a ±1 step
 * window (30s each side) to tolerate clock skew between server and the
 * authenticator app. Returns false for any malformed input.
 */
export function verifyTotpCode(secretBase32: string, code: string): boolean {
  const cleaned = (code || '').replace(/\s+/g, '')
  if (!/^\d{6}$/.test(cleaned)) return false
  try {
    const delta = buildTotp(secretBase32, 'account').validate({ token: cleaned, window: 1 })
    return delta !== null
  } catch {
    return false
  }
}
