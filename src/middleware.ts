import { auth } from "@/lib/auth/auth.edge"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import {
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
  csrfErrorResponse,
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

// Migration routes self-authenticate via `x-api-key: $ADMIN_API_KEY` (no
// session), so they must bypass the session gate. Listed explicitly rather
// than matched by `startsWith('/api/admin/run-migration-')` — an exact
// allowlist means a future run-migration-* route is NOT silently public
// until it's deliberately added here (it stays session-protected by default).
// Add the new path here whenever a migration route is created.
const PUBLIC_API_ADMIN_PATHS = new Set<string>([
  '/api/admin/run-migration-002',
  '/api/admin/run-migration-003',
  '/api/admin/run-migration-004',
  '/api/admin/run-migration-005',
  '/api/admin/run-migration-006',
  '/api/admin/run-migration-007',
  '/api/admin/run-migration-008',
  '/api/admin/run-migration-009',
  '/api/admin/run-migration-010',
  '/api/admin/run-migration-011',
  '/api/admin/run-migration-012',
  '/api/admin/run-migration-013',
  '/api/admin/run-migration-014',
  '/api/admin/run-migration-015',
  '/api/admin/run-migration-016',
  '/api/admin/run-migration-017',
  '/api/admin/run-migration-018',
  '/api/admin/run-migration-019',
  '/api/admin/run-migration-020',
  '/api/admin/run-migration-021',
  '/api/admin/run-migration-022',
  '/api/admin/run-migration-023',
  '/api/admin/run-migration-024',
  '/api/admin/run-migration-026',
  '/api/admin/run-migration-027',
  '/api/admin/run-migration-028',
  '/api/admin/run-migration-029',
])

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) return true
  if (PUBLIC_API_ADMIN_PATHS.has(pathname)) return true
  return false
}

function isSafeCallbackUrl(value: string | null | undefined): value is string {
  if (!value) return false
  if (!value.startsWith('/')) return false
  if (value.startsWith('//')) return false
  if (value.startsWith('/login') || value.startsWith('/signup')) return false
  return true
}

// ── B1: middleware-enforced CSRF (Option 2 — behavioral rule) ──────────
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

// Prefixes whose routes are not a cookie-CSRF surface (NextAuth/password,
// provider-signed webhooks, Bearer-secret cron/jobs, signed pusher auth,
// the csrf-init route itself).
const CSRF_EXEMPT_PREFIXES = [
  '/api/auth/',
  '/api/webhooks/',
  '/api/cron/',
  '/api/jobs/',
  '/api/pusher/',
  '/api/csrf/',
  // Unauthenticated, fire-and-forget telemetry sent via navigator.sendBeacon
  // (analytics-tracker.tsx) — beacon can't carry an X-CSRF-Token header, and
  // the route takes no session and has no per-user side effect (IP
  // rate-limited anonymous event insert), so it is not a cookie-CSRF surface.
  // NOTE: this is the ONLY analytics route exempted. /api/track-event is
  // session-authed (writes user-scoped userEvents) and is called via a normal
  // fetch the interceptor patches — it stays enforced.
  '/api/analytics/track',
]

/**
 * Whether this request must pass the CSRF double-submit check. Only mutating
 * /api/* requests qualify, minus the exempt prefixes and minus token-authed
 * requests — a Bearer / x-api-key caller is not cookie-authenticated, so the
 * browser can't forge it cross-site and there is no CSRF surface.
 */
function requiresCsrf(req: NextRequest): boolean {
  if (!MUTATING_METHODS.has(req.method)) return false
  const p = req.nextUrl.pathname
  if (!p.startsWith('/api/')) return false
  if (CSRF_EXEMPT_PREFIXES.some((pre) => p.startsWith(pre))) return false
  const authz = req.headers.get('authorization')
  if (authz && /^Bearer\s+/i.test(authz)) return false
  if (req.headers.get('x-admin-api-key')) return false
  if (req.headers.get('x-api-key')) return false
  return true
}

/**
 * Edge-safe double-submit check: the `x-csrf-token` header must match the
 * `e4i-csrf` cookie. Implemented with a pure-JS constant-time compare — the
 * shared csrf.ts validator pulls in node:crypto (timingSafeEqual/Buffer),
 * which is not available in the Edge middleware runtime.
 */
function validateCsrfEdge(req: NextRequest): boolean {
  const header = req.headers.get(CSRF_HEADER_NAME)
  if (!header) return false
  const cookie = req.cookies.get(CSRF_COOKIE_NAME)?.value
  if (!cookie) return false
  if (header.length !== cookie.length) return false
  let diff = 0
  for (let i = 0; i < header.length; i++) diff |= header.charCodeAt(i) ^ cookie.charCodeAt(i)
  return diff === 0
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
    // Fail closed if the session carries no loginNonce — without it the
    // proof cookie can't be bound to this login, so treat it as unpassed.
    const loginNonce = req.auth?.loginNonce ?? null
    const passed = loginNonce ? await verifyProofCookie(proof, loginNonce) : false
    // Diagnostic — surfaces in Vercel logs as `[2FA-DEBUG]`. Shows the
    // 2FA interlock saw a requires2FA session and whether the proof
    // cookie cleared it for this request.
    console.log(
      `[2FA-DEBUG] interlock path=${pathname} requires2FA=true`,
      `hasProofCookie=${!!proof} proofPassed=${passed}`,
    )
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

  // ── B1: CSRF check on cookie-authed mutating /api requests ──
  // Phased rollout: log-only by default; only returns 403 once
  // CSRF_ENFORCE='true' is set (flip on Vercel after verifying clean logs).
  // Runs before auth handling so a forged mutation is rejected outright.
  if (requiresCsrf(req) && !validateCsrfEdge(req)) {
    if (process.env.CSRF_ENFORCE === 'true') {
      const res = csrfErrorResponse()
      // Refresh the cookie so a legit client (e.g. cookie not yet minted) can
      // read the token and retry successfully.
      setCsrfCookie(res, req.cookies.get(CSRF_COOKIE_NAME)?.value ?? generateCsrfToken())
      res.headers.set('x-mw-ran', '1')
      res.headers.set('x-mw-decision', 'csrf-403')
      return res
    }
    // Log-only: surface what WOULD have been blocked, then fall through.
    console.warn(`[CSRF_WOULD_BLOCK] ${req.method} ${req.nextUrl.pathname}`)
  }

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
