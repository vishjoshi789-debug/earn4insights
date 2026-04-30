import { auth } from "@/lib/auth/auth.config"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

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

export default auth((req: NextRequest & { auth: any }) => {
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
    return NextResponse.next()
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
    return NextResponse.next()
  }

  if (isPublic(pathname)) {
    return NextResponse.next()
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

  return NextResponse.next()
})

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
