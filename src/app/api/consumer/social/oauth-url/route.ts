/**
 * Social OAuth URL builder
 * GET /api/consumer/social/oauth-url?platform=linkedin
 *
 * Returns { url } — the provider authorization URL with a server-signed
 * `state`. Generated here (not in the browser) so the state is HMAC-signed
 * with AUTH_SECRET and the userId / returnTo are server-controlled, which
 * closes the forgeable-state + open-redirect window in the callback.
 *
 * Session required (consumer or admin — mirrors who the callback accepts).
 */

import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { signOAuthState } from '@/lib/oauthState'

// Only platforms we can actually complete today. Instagram needs Facebook
// App Review; others are pending provider setup.
const BUILDABLE_PLATFORMS = new Set(['linkedin'])

export async function GET(req: NextRequest) {
  const session = await auth()
  const userId = (session?.user as any)?.id as string | undefined
  const role = (session?.user as any)?.role as string | undefined
  if (!session?.user?.email || !userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (role !== 'consumer' && role !== 'admin') {
    return NextResponse.json({ error: 'Consumer access only' }, { status: 403 })
  }

  const platform = req.nextUrl.searchParams.get('platform') ?? ''
  if (!BUILDABLE_PLATFORMS.has(platform)) {
    return NextResponse.json({ error: 'Unsupported platform' }, { status: 400 })
  }

  const clientId = process.env.LINKEDIN_CLIENT_ID
  const redirectUri = process.env.SOCIAL_OAUTH_REDIRECT_URI
  if (!clientId || !redirectUri) {
    return NextResponse.json({ error: 'OAuth not configured' }, { status: 503 })
  }

  // returnTo is server-set, never client-supplied — the callback redirects
  // back here after the round-trip.
  const state = await signOAuthState({ platform, userId, returnTo: '/dashboard/settings' })

  if (platform === 'linkedin') {
    // OpenID Connect scopes — `r_liteprofile` / `r_emailaddress` are retired
    // and trigger LinkedIn's "Bummer" error. The LinkedIn app's Products tab
    // must have "Sign In with LinkedIn using OpenID Connect" enabled.
    const url =
      'https://www.linkedin.com/oauth/v2/authorization' +
      '?response_type=code' +
      `&client_id=${encodeURIComponent(clientId)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      '&scope=openid%20profile%20email' +
      `&state=${encodeURIComponent(state)}`
    return NextResponse.json({ url })
  }

  return NextResponse.json({ error: 'Unsupported platform' }, { status: 400 })
}
