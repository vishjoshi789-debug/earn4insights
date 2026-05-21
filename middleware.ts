import { auth } from "@/lib/auth/auth.config"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import {
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
  generateCsrfToken,
  setCsrfCookie,
} from "@/lib/csrf"
import { TWO_FACTOR_PROOF_COOKIE, verifyProofCookie } from "@/lib/twoFactor/proofCookie"

const PUBLIC_PATHS = new Set<string>([
  '/',
  '/login',
  '/signup',
  '/onboarding',
  '/about-us',
  '/privacy-policy',
  '/terms-of-service',
  '/refund-policy',
  '/contact-us',
  '/transparency',
  '/rankings',
  '/forgot-password',
  '/help',
  '/favicon.ico',
])

const PUBLIC_PREFIXES: string[] = [
  '/_next/',
  '/images/',
  '/fonts/',
  '/api/auth/',
  '/api/webhooks/',
  '/api/cron/',
  '/api/jobs/',
  '/help/',
  '/api/support/faq',
  '/api/csrf/',
]

const PUBLIC_API_ADMIN_PREFIXES: string[] = [
  '/api/admin/run-migration-',
]

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) return true
  if (PUBLIC_API_ADMIN_PREFIXES.some((p) => pathname.startsWith(p))) return true
  return false
}

function isSafeCallbackUrl(value: string | null | undefined): value is string {
  if (!value) return false
  if (!value.startsWith('/')) return false
  if (value.startsWith('//')) return false
  if (value.startsWith('/login') || value.startsWith('/signup')) return false
  return true
}

/**
 * Paths a requires-2FA session may still reach: the challenge page, the
 * challenge/status APIs, NextAuth internals, CSRF init, and static assets.
 * Everything else is blocked until a valid 2FA proof cookie is present.
 *
 * NOTE: /api/auth/2fa/{setup,verify-setup,disable,regenerate-codes,
 * trusted-devices} are deliberately NOT allowed — letting a user disable
 * 2FA mid-challenge would defeat the gate.
 */
function isAllowedDuringTwoFactor(pathname: string): boolean {
  if (pathname === '/auth/two-factor') return true
  if (
    pathname === '/api/auth/2fa/verify' ||
    pathname === '/api/auth/2fa/recovery' ||
    pathname === '/api/auth/2fa/status'
  ) {
    return true
  }
  // NextAuth internals (session, signout, csrf, callback) — but not our
  // own /api/auth/2fa/* management routes.
  if (pathname.startsWith('/api/auth/') && !pathname.startsWith('/api/auth/2fa/')) return true
  if (pathname.startsWith('/api/csrf/')) return true
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/images/') ||
    pathname.startsWith('/fonts/') ||
    pathname === '/favicon.ico'
  ) {
    return true
  }
  return false
}

async function decideAuth(req: NextRequest & { auth: any }): Promise<NextResponse | null> {
  const { nextUrl } = req
  const pathname = nextUrl.pathname
  const isLoggedIn = !!req.auth
  const role = req.auth?.user?.role as string | undefined

  // ── 2FA interlock ──────────────────────────────────────────────
  // A logged-in session flagged requires2FA is confined to the 2FA
  // challenge until it presents a valid, unexpired e4i-2fa proof cookie
  // bound to this login's nonce.
  if (isLoggedIn && req.auth?.requires2FA === true) {
    const proof = req.cookies.get(TWO_FACTOR_PROOF_COOKIE)?.value
    const passed = await verifyProofCookie(proof, req.auth?.loginNonce ?? null)
    if (!passed) {
      if (isAllowedDuringTwoFactor(pathname)) return null
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { error: 'Two-factor authentication required' },
          { status: 403 },
        )
      }
      const url = new URL('/auth/two-factor', nextUrl)
      if (pathname !== '/') {
        url.searchParams.set('callbackUrl', pathname + nextUrl.search)
      }
      return NextResponse.redirect(url)
    }
    // proof valid → 2FA satisfied → fall through to normal handling.
  }

  // The challenge page is only for sessions still mid-challenge. A fully
  // authenticated user who lands here is sent to the dashboard; a
  // logged-out visitor to /login.
  if (pathname === '/auth/two-factor') {
    if (!isLoggedIn) {
      const url = new URL('/login', nextUrl)
      url.searchParams.set('callbackUrl', pathname)
      return NextResponse.redirect(url)
    }
    return NextResponse.redirect(new URL('/dashboard', nextUrl))
  }

  if (pathname === '/login' || pathname === '/signup') {
    if (isLoggedIn) {
      const cb = nextUrl.searchParams.get('callbackUrl')
      const target = isSafeCallbackUrl(cb) ? cb : '/dashboard'
      return NextResponse.redirect(new URL(target, nextUrl))
    }
    return null
  }

  if (pathname.startsWith('/onboarding')) {
    if (!isLoggedIn) {
      const url = new URL('/login', nextUrl)
      url.searchParams.set('callbackUrl', pathname + nextUrl.search)
      return NextResponse.redirect(url)
    }
    if (role === 'brand') {
      return NextResponse.redirect(new URL('/dashboard', nextUrl))
    }
    return null
  }

  if (isPublic(pathname)) {
    return null
  }

  if (!isLoggedIn) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const url = new URL('/login', nextUrl)
    url.searchParams.set('callbackUrl', pathname + nextUrl.search)
    return NextResponse.redirect(url)
  }

  if (pathname.startsWith('/admin')) {
    if (role !== 'admin') {
      return NextResponse.redirect(new URL('/dashboard', nextUrl))
    }
  }

  return null
}

export default auth(async (req: NextRequest & { auth: any }) => {
  // Diagnostic — proves middleware actually ran for this request.
  // Visible in Vercel logs as `[MW] path=...` and on every response
  // as the `x-mw-ran` header so DevTools can verify per-request.
  console.log(`[MW] path=${req.nextUrl.pathname} authed=${!!req.auth}`)

  const decision = await decideAuth(req)

  const existing = req.cookies.get(CSRF_COOKIE_NAME)?.value
  const token = existing ?? generateCsrfToken()

  if (decision) {
    // Always refresh — keeps maxAge sliding so the cookie never
    // expires mid-session while the user is active.
    setCsrfCookie(decision, token)
    decision.headers.set('x-mw-ran', '1')
    decision.headers.set('x-mw-decision', 'redirect')
    return decision
  }

  const requestHeaders = new Headers(req.headers)
  requestHeaders.set(CSRF_HEADER_NAME, token)
  // Forward the request path so the root layout can log which URL
  // triggered an empty-csrf-token render (diagnostic).
  requestHeaders.set('x-pathname', req.nextUrl.pathname)
  const response = NextResponse.next({ request: { headers: requestHeaders } })
  // Same — refresh every response so an active session never sees an expired cookie.
  setCsrfCookie(response, token)
  response.headers.set('x-mw-ran', '1')
  response.headers.set('x-mw-decision', 'continue')
  return response
})

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
