/**
 * Social OAuth Callback Handler
 * GET /api/consumer/social/callback
 *
 * Receives the OAuth redirect from the provider after user authorization.
 * Exchanges the authorization code for an access token, then stores the
 * encrypted connection via the connect logic.
 *
 * Query params (set by the provider redirect):
 *   code     — authorization code
 *   state    — encoded JSON: { platform, userId, returnTo }
 *              (set by the UI when initiating the OAuth flow)
 *   error    — set by provider if user denied access
 *
 * Provider OAuth URLs (initiate from the UI):
 *   LinkedIn:  https://www.linkedin.com/oauth/v2/authorization
 *              ?response_type=code
 *              &client_id=${LINKEDIN_CLIENT_ID}
 *              &redirect_uri=${SOCIAL_OAUTH_REDIRECT_URI}
 *              &scope=r_liteprofile%20r_emailaddress
 *              &state=<base64(JSON)>
 *
 *   Instagram: Instagram Basic Display API was deprecated in 2025.
 *              Use Instagram Graph API via Facebook App in Advanced Access.
 *              Requires App Review before production use.
 *
 * Required env vars:
 *   LINKEDIN_CLIENT_ID
 *   LINKEDIN_CLIENT_SECRET
 *   SOCIAL_OAUTH_REDIRECT_URI   — must match the redirect URI registered in provider app
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { enforceConsent } from '@/lib/consent-enforcement'
import { getConsent } from '@/db/repositories/consentRepository'
import { encryptForStorage } from '@/lib/encryption'
import {
  createSocialConnection,
  getActiveConnection,
} from '@/db/repositories/socialConnectionRepository'
import type { SocialPlatform } from '@/db/repositories/socialConnectionRepository'

type OAuthState = {
  platform: SocialPlatform
  userId: string
  returnTo: string
}

type LinkedInTokenResponse = {
  access_token: string
  expires_in: number   // seconds
  error?: string
  error_description?: string
}

async function exchangeLinkedInCode(code: string): Promise<{ accessToken: string; expiresAt: string }> {
  const clientId = process.env.LINKEDIN_CLIENT_ID
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET
  const redirectUri = process.env.SOCIAL_OAUTH_REDIRECT_URI

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('LinkedIn OAuth env vars not configured (LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET, SOCIAL_OAUTH_REDIRECT_URI)')
  }

  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    client_secret: clientSecret,
  })

  const res = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })

  const data: LinkedInTokenResponse = await res.json()

  if (data.error || !data.access_token) {
    throw new Error(`LinkedIn token exchange failed: ${data.error_description ?? data.error}`)
  }

  const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString()
  return { accessToken: data.access_token, expiresAt }
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const error = searchParams.get('error')
  const code = searchParams.get('code')
  const rawState = searchParams.get('state')

  // Parse state
  let state: OAuthState | null = null
  try {
    state = rawState ? JSON.parse(Buffer.from(rawState, 'base64').toString('utf8')) : null
  } catch {
    return NextResponse.redirect(new URL('/dashboard/settings?social=error&reason=invalid_state', req.url))
  }

  const returnTo = state?.returnTo ?? '/dashboard/settings'

  // Provider denied or user cancelled
  if (error) {
    return NextResponse.redirect(
      new URL(`${returnTo}?social=error&reason=${encodeURIComponent(error)}`, req.url)
    )
  }

  if (!code || !state?.platform || !state?.userId) {
    return NextResponse.redirect(new URL(`${returnTo}?social=error&reason=missing_params`, req.url))
  }

  try {
    // Verify the session matches the userId in state (CSRF protection)
    const session = await auth()
    const sessionUserId = (session?.user as any)?.id
    if (!session || sessionUserId !== state.userId) {
      return NextResponse.redirect(new URL(`${returnTo}?social=error&reason=session_mismatch`, req.url))
    }

    const userId = state.userId
    const platform = state.platform

    // Enforce consent
    await enforceConsent(userId, 'social', 'connect_social_account')

    // Get active consent record ID
    const consentRecord = await getConsent(userId, 'social')
    if (!consentRecord) {
      return NextResponse.redirect(new URL(`${returnTo}?social=error&reason=no_consent`, req.url))
    }

    // Check not already connected
    const existing = await getActiveConnection(userId, platform)
    if (existing) {
      return NextResponse.redirect(new URL(`${returnTo}?social=already_connected&platform=${platform}`, req.url))
    }

    // Exchange code for token
    let accessToken: string
    let expiresAt: string
    if (platform === 'linkedin') {
      const tokens = await exchangeLinkedInCode(code)
      accessToken = tokens.accessToken
      expiresAt = tokens.expiresAt
    } else {
      // Other platforms pending provider setup
      return NextResponse.redirect(
        new URL(`${returnTo}?social=error&reason=platform_not_configured&platform=${platform}`, req.url)
      )
    }

    // Encrypt and store
    const tokenPayload = JSON.stringify({ accessToken, expiresAt })
    const { encryptedValue, encryptionKeyId } = await encryptForStorage(tokenPayload)

    await createSocialConnection({
      userId,
      platform,
      encryptedAccessToken: encryptedValue,
      encryptionKeyId,
      consentRecordId: consentRecord.id,
      inferredInterests: {},
      inferenceMethod: 'followed_accounts',
    })

    return NextResponse.redirect(
      new URL(`${returnTo}?social=connected&platform=${platform}`, req.url)
    )
  } catch (err) {
    console.error('[Social OAuth Callback] Error:', err)
    return NextResponse.redirect(new URL(`${returnTo}?social=error&reason=server_error`, req.url))
  }
}
