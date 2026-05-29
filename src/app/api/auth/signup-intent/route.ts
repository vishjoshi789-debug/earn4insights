import { NextRequest, NextResponse } from 'next/server'
import {
  SIGNUP_INTENT_COOKIE,
  SIGNUP_INTENT_TTL_MS,
  isAllowedSignupRole,
  signSignupIntent,
} from '@/lib/auth/signupIntent'
import { validateCsrfToken, csrfErrorResponse } from '@/lib/csrf'

/**
 * POST /api/auth/signup-intent
 * Body: { role: 'brand' | 'consumer' }
 *
 * Mints a signed `e4i-signup-intent` cookie carrying the chosen role.
 * The /signup page calls this immediately before signIn('google'), so the
 * auth.config signIn callback can read the role after the Google round-trip
 * and create the user at the intended role instead of guessing.
 *
 * Anonymous + CSRF-protected:
 *   - Anonymous because the caller is by definition not yet signed in.
 *   - CSRF check ensures the call originated from our own site (an attacker
 *     can't pre-set an intent cookie via a cross-origin POST from another
 *     tab; even if they could, they can't complete the Google flow that
 *     consumes it).
 *
 * The /login page must NOT call this route — logging in with Google by a
 * brand-new user is intentionally rejected (see auth.config signIn callback).
 *
 * Response is intentionally minimal (just `{ ok: true }`); the cookie is
 * the side-effect. Errors return JSON with a 400/403 status.
 */
export async function POST(request: NextRequest) {
  if (!validateCsrfToken(request)) return csrfErrorResponse()

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const role = (body as { role?: unknown } | null)?.role
  if (!isAllowedSignupRole(role)) {
    return NextResponse.json(
      { error: 'role must be "brand" or "consumer"' },
      { status: 400 },
    )
  }

  let cookieValue: string
  try {
    cookieValue = await signSignupIntent(role)
  } catch (err) {
    console.error('[signup-intent] sign failed:', err)
    return NextResponse.json(
      { error: 'Signup intent could not be issued' },
      { status: 500 },
    )
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set(SIGNUP_INTENT_COOKIE, cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax', // 'lax' is required — OAuth round-trip is a top-level navigation
    path: '/',
    maxAge: Math.floor(SIGNUP_INTENT_TTL_MS / 1000),
  })
  return res
}
