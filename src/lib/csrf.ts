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
 */
export function validateCsrfToken(request: Request): boolean {
  const headerToken = request.headers.get(CSRF_HEADER_NAME)
  if (!headerToken) return false
  const cookieToken = readCookieValue(request.headers.get('cookie'), CSRF_COOKIE_NAME)
  if (!cookieToken) return false
  if (headerToken.length !== cookieToken.length) return false
  try {
    return timingSafeEqual(Buffer.from(headerToken), Buffer.from(cookieToken))
  } catch {
    return false
  }
}

export function csrfErrorResponse(): NextResponse {
  return NextResponse.json({ error: 'Invalid or missing CSRF token.' }, { status: 403 })
}
