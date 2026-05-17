import { NextRequest, NextResponse } from 'next/server'
import {
  CSRF_COOKIE_NAME,
  generateCsrfToken,
  setCsrfCookie,
} from '@/lib/csrf'

/**
 * CSRF cookie bootstrap.
 *
 * GET /api/csrf/init
 *
 * Mints (or refreshes) the `e4i-csrf` cookie and returns the token in
 * both the response body and the `X-CSRF-Token` response header. This
 * route is the SAFETY NET for the cases where Next.js middleware fails
 * to set the cookie on a page load (we have observed this in production
 * for /onboarding and /dashboard renders that go through redirects).
 *
 * Public — no auth, no CSRF check (idempotent + safe; the cookie value
 * is the only thing it produces, and producing one is what we want).
 *
 * Usage from the client (see ChatTab):
 *   await fetch('/api/csrf/init', { credentials: 'same-origin' })
 *   // Now the browser has the cookie. Subsequent POSTs work.
 */
function handle(req: NextRequest): NextResponse {
  const existing = req.cookies.get(CSRF_COOKIE_NAME)?.value
  const token = existing ?? generateCsrfToken()
  const response = NextResponse.json({ ok: true, hadCookie: !!existing })
  setCsrfCookie(response, token)
  // Surface the token in a response header too, so a debugger can see
  // it without parsing cookies.
  response.headers.set('X-CSRF-Token', token)
  // Mark this response so the caller can confirm it hit this route
  // (and not a cached / wrong handler).
  response.headers.set('X-CSRF-Init', '1')
  return response
}

export const GET = handle
export const POST = handle
