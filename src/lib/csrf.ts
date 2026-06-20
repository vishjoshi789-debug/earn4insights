import 'server-only'
import { NextResponse } from 'next/server'

// NB: Web Crypto only (no node:crypto). This module is imported by the Edge
// middleware, which mints the CSRF cookie via generateCsrfToken() on every
// request — node:crypto's randomBytes/timingSafeEqual throw on the Edge
// runtime (MIDDLEWARE_INVOCATION_FAILED). `crypto.getRandomValues` and the
// pure-JS constant-time compare below work in both Node and Edge.

export const CSRF_COOKIE_NAME = 'e4i-csrf'
export const CSRF_HEADER_NAME = 'x-csrf-token'
const TOKEN_LENGTH_BYTES = 32
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 // 24h

export function generateCsrfToken(): string {
  const bytes = new Uint8Array(TOKEN_LENGTH_BYTES)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
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

export type CsrfFailureReason =
  | 'missing_header'
  | 'missing_cookie'
  | 'length_mismatch'
  | 'value_mismatch'
  | 'comparison_threw'

export type CsrfCheckResult =
  | { ok: true }
  | { ok: false; reason: CsrfFailureReason; detail: string }

/**
 * Check whether the X-CSRF-Token header matches the e4i-csrf cookie.
 * Returns a tagged result so callers can surface the failure reason in
 * the response body (callers who don't care can use validateCsrfToken).
 *
 * Also logs every failure as `[CSRF_FAIL] <reason> ...` on the server
 * console for log-based diagnosis.
 */
export function checkCsrf(request: Request): CsrfCheckResult {
  const pathname = (() => {
    try { return new URL(request.url).pathname } catch { return '?' }
  })()
  const headerToken = request.headers.get(CSRF_HEADER_NAME)
  if (!headerToken) {
    const detail = `hasCookieHeader=${!!request.headers.get('cookie')}`
    console.warn(`[CSRF_FAIL] missing_header url=${pathname} ${detail}`)
    return { ok: false, reason: 'missing_header', detail }
  }
  const cookieToken = readCookieValue(request.headers.get('cookie'), CSRF_COOKIE_NAME)
  if (!cookieToken) {
    const detail = `headerLen=${headerToken.length} hasCookieHeader=${!!request.headers.get('cookie')}`
    console.warn(`[CSRF_FAIL] missing_cookie url=${pathname} ${detail}`)
    return { ok: false, reason: 'missing_cookie', detail }
  }
  if (headerToken.length !== cookieToken.length) {
    const detail = `headerLen=${headerToken.length} cookieLen=${cookieToken.length}`
    console.warn(`[CSRF_FAIL] length_mismatch url=${pathname} ${detail}`)
    return { ok: false, reason: 'length_mismatch', detail }
  }
  // Constant-time compare (lengths already verified equal above). Pure JS so
  // the module stays Edge-safe — see the header note.
  let diff = 0
  for (let i = 0; i < headerToken.length; i++) {
    diff |= headerToken.charCodeAt(i) ^ cookieToken.charCodeAt(i)
  }
  if (diff !== 0) {
    const detail = `headerPrefix=${headerToken.slice(0, 8)} cookiePrefix=${cookieToken.slice(0, 8)}`
    console.warn(`[CSRF_FAIL] value_mismatch url=${pathname} ${detail}`)
    return { ok: false, reason: 'value_mismatch', detail }
  }
  return { ok: true }
}

/**
 * Backwards-compatible boolean wrapper around checkCsrf — keeps the
 * existing 17 callers unchanged while new callers can use checkCsrf
 * to surface the failure reason in the response.
 */
export function validateCsrfToken(request: Request): boolean {
  return checkCsrf(request).ok
}

/**
 * 403 response when the CSRF check fails. If a reason + detail are
 * provided, they're included in the response body and an
 * `X-CSRF-Fail-Reason` response header — so the failure is visible
 * in the browser's Network tab without log diving.
 */
export function csrfErrorResponse(failure?: { reason: CsrfFailureReason; detail?: string }): NextResponse {
  const response = NextResponse.json(
    {
      error: 'Invalid or missing CSRF token.',
      ...(failure?.reason ? { reason: failure.reason } : {}),
      ...(failure?.detail ? { detail: failure.detail } : {}),
    },
    { status: 403 }
  )
  if (failure?.reason) response.headers.set('X-CSRF-Fail-Reason', failure.reason)
  return response
}
