import { auth } from "@/lib/auth/auth.config"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export default auth((req: NextRequest & { auth: any }) => {
  const { nextUrl } = req
  const isLoggedIn = !!req.auth

  // Define route patterns
  const isAuthPage = nextUrl.pathname.startsWith('/login') || nextUrl.pathname.startsWith('/signup')
  const isBrandRoute = nextUrl.pathname.startsWith('/dashboard')
  const isConsumerRoute = nextUrl.pathname.startsWith('/surveys') || nextUrl.pathname.startsWith('/respond')
  const isOnboardingRoute = nextUrl.pathname.startsWith('/onboarding')
  const isSettingsRoute = nextUrl.pathname.startsWith('/settings')
  const isPublicRoute = nextUrl.pathname.startsWith('/rankings') || 
                        nextUrl.pathname.startsWith('/privacy-policy') ||
                        nextUrl.pathname.startsWith('/terms-of-service') ||
                        nextUrl.pathname === '/'

  // Redirect logged-in users away from auth pages
  if (isAuthPage && isLoggedIn) {
    // First-time users will be redirected to onboarding by OnboardingGuard
    const redirectUrl = req.auth?.user?.role === 'brand' ? '/dashboard' : '/top-products'
    return NextResponse.redirect(new URL(redirectUrl, nextUrl))
  }

  // Allow onboarding route for logged-in users (no role check)
  if (isOnboardingRoute && isLoggedIn) {
    return NextResponse.next()
  }

  // Allow settings route for logged-in users
  if (isSettingsRoute && isLoggedIn) {
    return NextResponse.next()
  }

  // Protect onboarding route from non-logged-in users
  if (isOnboardingRoute && !isLoggedIn) {
    return NextResponse.redirect(new URL('/login', nextUrl))
  }

  // Protect brand routes
  if (isBrandRoute && !isLoggedIn) {
    return NextResponse.redirect(new URL('/login', nextUrl))
  }

  if (isBrandRoute && isLoggedIn && req.auth?.user?.role !== 'brand') {
    return NextResponse.redirect(new URL('/top-products', nextUrl))
  }

  // Protect consumer routes (if any are protected)
  if (isConsumerRoute && !isLoggedIn) {
    return NextResponse.redirect(new URL('/login', nextUrl))
  }

  return NextResponse.next()
})

// Configure which routes to run middleware on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}
