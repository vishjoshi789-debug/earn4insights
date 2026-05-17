import 'server-only'
import { randomBytes, timingSafeEqual } from 'crypto'
import { NextResponse } from 'next/server'

export const CSRF_COOKIE_NAME = 'e4i-csrf'
export const CSRF_HEADER_NAME = 'x-csrf-token'
const TOKEN_LENGTH_BYTES = 32
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 // 24h

export function generateCsrfToken(): string {
  return randomBytes(TOKEN_LENGTH_BYTES).toString('hex')
}

/**
 * Set the CSRF cookie on a response. httpOnly:false on purpose — the client
 * reads the token from a meta tag injected into the dashboard layout.
 * Security relies on the double-submit pattern: a cross-origin attacker can
 * neither read the cookie (Same-Origin Policy) nor set the X-CSRF-Token
 * header on a forged form post.
 */
export function setCsrfCookie(response: NextResponse, token: string): void {
  response.cookies.set({
    name: CSRF_COOKIE_NAME,
    value: token,
    httpOnly: false,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: COOKIE_MAX_AGE_SECONDS,
  })
}

function readCookieValue(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null
  const entry = cookieHeader
    .split(';')
    .map((s) => s.trim())
    .find((c) => c.startsWith(`${name}=`))
  return entry ? decodeURIComponent(entry.slice(name.length + 1)) : null
}

/**
 * Validate that X-CSRF-Token header matches e4i-csrf cookie via
 * timing-safe comparison. Returns true on match.
 *
 * Logs the failure reason to the server console (greppable as
 * `[CSRF_FAIL]`) so we can diagnose which leg of the double-submit
 * pattern is breaking in production.
 */
export function validateCsrfToken(request: Request): boolean {
  const headerToken = request.headers.get(CSRF_HEADER_NAME)
  if (!headerToken) {
    console.warn(
      `[CSRF_FAIL] missing header url=${new URL(request.url).pathname} ` +
      `hasCookieHeader=${!!request.headers.get('cookie')}`
    )
    return false
  }
  const cookieToken = readCookieValue(request.headers.get('cookie'), CSRF_COOKIE_NAME)
  if (!cookieToken) {
    console.warn(
      `[CSRF_FAIL] missing cookie url=${new URL(request.url).pathname} ` +
      `headerLen=${headerToken.length} hasCookieHeader=${!!request.headers.get('cookie')}`
    )
    return false
  }
  if (headerToken.length !== cookieToken.length) {
    console.warn(
      `[CSRF_FAIL] length mismatch url=${new URL(request.url).pathname} ` +
      `headerLen=${headerToken.length} cookieLen=${cookieToken.length}`
    )
    return false
  }
  try {
    const ok = timingSafeEqual(Buffer.from(headerToken), Buffer.from(cookieToken))
    if (!ok) {
      console.warn(
        `[CSRF_FAIL] value mismatch url=${new URL(request.url).pathname} ` +
        `headerPrefix=${headerToken.slice(0, 8)} cookiePrefix=${cookieToken.slice(0, 8)}`
      )
    }
    return ok
  } catch (err) {
    console.warn(
      `[CSRF_FAIL] comparison threw url=${new URL(request.url).pathname} err=${err instanceof Error ? err.message : String(err)}`
    )
    return false
  }
}

export function csrfErrorResponse(): NextResponse {
  return NextResponse.json({ error: 'Invalid or missing CSRF token.' }, { status: 403 })
}
