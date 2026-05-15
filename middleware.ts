import { auth } from "@/lib/auth/auth.config"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import {
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
  generateCsrfToken,
  setCsrfCookie,
} from "@/lib/csrf"

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

function decideAuth(req: NextRequest & { auth: any }): NextResponse | null {
  const { nextUrl } = req
  const pathname = nextUrl.pathname
  const isLoggedIn = !!req.auth
  const role = req.auth?.user?.role as string | undefined

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

export default auth((req: NextRequest & { auth: any }) => {
  const decision = decideAuth(req)

  const existing = req.cookies.get(CSRF_COOKIE_NAME)?.value
  const token = existing ?? generateCsrfToken()

  if (decision) {
    if (!existing) setCsrfCookie(decision, token)
    return decision
  }

  const requestHeaders = new Headers(req.headers)
  requestHeaders.set(CSRF_HEADER_NAME, token)
  const response = NextResponse.next({ request: { headers: requestHeaders } })
  if (!existing) setCsrfCookie(response, token)
  return response
})

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
