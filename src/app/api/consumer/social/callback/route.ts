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
 *              &scope=openid%20profile%20email
 *              &state=<base64(JSON)>
 *
 *              Uses OpenID Connect scopes. The old `r_liteprofile` /
 *              `r_emailaddress` scopes are retired and produce a
 *              "Bummer" error from LinkedIn. Requires the "Sign In with
 *              LinkedIn using OpenID Connect" product on the LinkedIn app.
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
import { getConsent, grantConsent } from '@/db/repositories/consentRepository'
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

  // Surfaces as [LinkedIn-Callback] in Vercel logs. The auth code is
  // single-use and short-lived, so logging it is fine for debugging.
  console.log('[LinkedIn-Callback] entered',
    'hasCode=', !!code,
    'hasState=', !!state,
    'provider_error=', error || '(none)',
    'platform=', state?.platform,
  )

  const returnTo = state?.returnTo ?? '/dashboard/settings'

  // Provider denied or user cancelled
  if (error) {
    console.warn('[LinkedIn-Callback] provider returned error:', error)
    return NextResponse.redirect(
      new URL(`${returnTo}?social=error&reason=${encodeURIComponent(error)}`, req.url)
    )
  }

  if (!code || !state?.platform || !state?.userId) {
    console.warn('[LinkedIn-Callback] missing required params — code:', !!code,
      'platform:', state?.platform, 'userId:', state?.userId)
    return NextResponse.redirect(new URL(`${returnTo}?social=error&reason=missing_params`, req.url))
  }

  try {
    // Verify the session matches the userId in state (CSRF protection)
    const session = await auth()
    const sessionUserId = (session?.user as any)?.id
    const role = (session?.user as any)?.role as string | undefined
    if (!session || sessionUserId !== state.userId) {
      console.warn('[LinkedIn-Callback] session_mismatch — sessionUserId:', sessionUserId,
        'stateUserId:', state.userId)
      return NextResponse.redirect(new URL(`${returnTo}?social=error&reason=session_mismatch`, req.url))
    }
    console.log('[LinkedIn-Callback] session OK userId=', sessionUserId, 'role=', role)

    const userId = state.userId
    const platform = state.platform

    // Consent gate. Admin is the data subject + controller for their own
    // account, so the admin self-grants social consent here — that lets
    // the platform owner exercise the same Connect flow consumers do
    // without a separate consent-grant UI hop. grantConsent is
    // idempotent (onConflictDoUpdate on user+category), and the grant is
    // still recorded in consent_records for the GDPR audit trail.
    if (role === 'admin') {
      console.log('[LinkedIn-Callback] admin role — auto-granting social consent')
      await grantConsent(userId, 'social', {
        purpose: 'admin_self_connect',
        consentVersion: 'admin-1',
        ipAddress: req.headers.get('x-forwarded-for') ?? undefined,
        userAgent: req.headers.get('user-agent') ?? undefined,
      })
    } else {
      await enforceConsent(userId, 'social', 'connect_social_account')
    }
    console.log('[LinkedIn-Callback] consent OK')

    // Get active consent record ID
    const consentRecord = await getConsent(userId, 'social')
    if (!consentRecord) {
      console.warn('[LinkedIn-Callback] no consent record after enforce/grant — userId:', userId)
      return NextResponse.redirect(new URL(`${returnTo}?social=error&reason=no_consent`, req.url))
    }

    // Check not already connected
    const existing = await getActiveConnection(userId, platform)
    if (existing) {
      console.log('[LinkedIn-Callback] already connected — platform:', platform)
      return NextResponse.redirect(new URL(`${returnTo}?social=already_connected&platform=${platform}`, req.url))
    }

    // Exchange code for token
    let accessToken: string
    let expiresAt: string
    if (platform === 'linkedin') {
      const tokens = await exchangeLinkedInCode(code)
      accessToken = tokens.accessToken
      expiresAt = tokens.expiresAt
      console.log('[LinkedIn-Callback] token exchange OK expiresAt=', expiresAt)
    } else {
      console.warn('[LinkedIn-Callback] platform_not_configured — platform:', platform)
      return NextResponse.redirect(
        new URL(`${returnTo}?social=error&reason=platform_not_configured&platform=${platform}`, req.url)
      )
    }

    // Phase 4 — capture the platform's immutable subject id so a future
    // listening adapter can attribute posts back to this user via
    // handleAttributionService. Strictly optional: a userinfo failure
    // must NOT break the OAuth completion. The connection still saves;
    // it just won't participate in attribution. The handle column is
    // left NULL for LinkedIn (OIDC userinfo does not expose vanity URL).
    let verifiedSubject: string | null = null
    if (platform === 'linkedin') {
      try {
        const ui = await fetch('https://api.linkedin.com/v2/userinfo', {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        if (ui.ok) {
          const data = await ui.json()
          if (typeof data?.sub === 'string' && data.sub.length > 0) {
            verifiedSubject = data.sub        // e.g. "urn:li:person:abc123"
            console.log('[LinkedIn-Callback] userinfo OK — verified_subject captured')
          } else {
            console.warn('[LinkedIn-Callback] userinfo missing sub field')
          }
        } else {
          console.warn('[LinkedIn-Callback] userinfo non-200:', ui.status)
        }
      } catch (uiErr) {
        console.warn('[LinkedIn-Callback] userinfo failed (non-fatal):', uiErr)
      }
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
      verifiedHandle: null,                    // LinkedIn OIDC has no vanity handle; future platforms will populate
      verifiedSubject,
      handleVerifiedAt: verifiedSubject ? new Date() : null,
    })
    console.log('[LinkedIn-Callback] connection stored — platform:', platform)

    return NextResponse.redirect(
      new URL(`${returnTo}?social=connected&platform=${platform}`, req.url)
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[LinkedIn-Callback] ERROR:', msg)
    console.error('[LinkedIn-Callback] Full error:',
      err instanceof Error ? (err.stack ?? err) : JSON.stringify(err, null, 2))

    // Map known error signatures onto specific redirect reasons so the
    // user-facing URL points at the actual cause instead of a generic
    // "server_error" that hides everything.
    let reason = 'server_error'
    if (/has not consented/i.test(msg)) reason = 'no_consent'
    else if (/LinkedIn token exchange failed/i.test(msg)) reason = 'token_exchange_failed'
    else if (/OAuth env vars not configured/i.test(msg)) reason = 'oauth_not_configured'

    return NextResponse.redirect(new URL(`${returnTo}?social=error&reason=${reason}`, req.url))
  }
}
