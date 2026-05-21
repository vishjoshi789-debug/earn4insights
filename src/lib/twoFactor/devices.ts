import 'server-only'

import { createHmac, createHash, randomBytes, timingSafeEqual } from 'crypto'

/**
 * Trusted-device identification.
 *
 * A trusted device is identified by a random opaque token stored in the
 * `e4i-trusted-device` cookie (httpOnly, signed with AUTH_SECRET). Only a
 * SHA-256 hash of the token is persisted as `trusted_devices.device_fingerprint`
 * — the DB never holds anything that can re-derive the cookie.
 *
 * This survives IP/network changes and cannot be matched by another
 * person sharing the same NAT + browser (unlike a UA+IP fingerprint).
 */

export const TRUSTED_DEVICE_COOKIE = 'e4i-trusted-device'
export const TRUSTED_DEVICE_TTL_DAYS = 30

function authSecret(): string {
  const s = process.env.AUTH_SECRET
  if (!s) throw new Error('AUTH_SECRET is required to sign trusted-device cookies')
  return s
}

/** Random opaque device token — the value carried in the cookie. */
export function generateDeviceToken(): string {
  return randomBytes(32).toString('hex')
}

/** SHA-256 of the token — stored as device_fingerprint (not reversible). */
export function fingerprintToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/** Signed cookie value: `<token>.<hmac>`. */
export function signDeviceCookie(token: string): string {
  const sig = createHmac('sha256', authSecret()).update(token).digest('hex')
  return `${token}.${sig}`
}

/**
 * Verify the signature on a cookie value and return the device token.
 * Returns null if the cookie is missing, malformed, or tampered with.
 */
export function readDeviceCookie(cookieValue: string | null | undefined): string | null {
  if (!cookieValue) return null
  const dot = cookieValue.lastIndexOf('.')
  if (dot <= 0) return null
  const token = cookieValue.slice(0, dot)
  const sig = cookieValue.slice(dot + 1)
  const expected = createHmac('sha256', authSecret()).update(token).digest('hex')
  try {
    if (sig.length !== expected.length) return null
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null
  } catch {
    return null
  }
  return token
}

/** Human-readable device name parsed from a User-Agent, e.g. "Chrome on Windows". */
export function parseDeviceName(userAgent: string | null | undefined): string {
  const ua = userAgent || ''
  // Order matters: Edge/Opera UAs also contain "Chrome"; Chrome contains "Safari".
  const browser =
    /Edg\//.test(ua) ? 'Edge' :
    /OPR\/|Opera/.test(ua) ? 'Opera' :
    /Chrome\//.test(ua) ? 'Chrome' :
    /Firefox\//.test(ua) ? 'Firefox' :
    /Safari\//.test(ua) ? 'Safari' :
    'Browser'
  const os =
    /Windows/.test(ua) ? 'Windows' :
    /Android/.test(ua) ? 'Android' :
    /iPhone|iPad|iPod/.test(ua) ? 'iOS' :
    /Mac OS X|Macintosh/.test(ua) ? 'macOS' :
    /Linux/.test(ua) ? 'Linux' :
    'Unknown OS'
  return `${browser} on ${os}`
}
