/**
 * Consumer Social Connect
 * POST /api/consumer/social/connect
 *
 * Handles the OAuth token exchange and stores the encrypted connection.
 *
 * Flow (server-side OAuth):
 *  1. UI redirects user to provider OAuth URL with app's client_id + redirect_uri.
 *  2. Provider redirects back to /api/consumer/social/callback with ?code=xxx.
 *  3. Callback route exchanges the code for a token, then calls this route
 *     internally (or this route can be called directly for PKCE flows).
 *
 * Body: {
 *   platform: 'instagram' | 'linkedin' | 'twitter' | 'youtube'
 *   accessToken: string       — the raw access token from the provider
 *   expiresAt?: string        — ISO timestamp of token expiry (optional)
 *   consentRecordId: string   — UUID of the active 'social' consent_records row
 * }
 *
 * Note on provider support:
 *   - LinkedIn: Available. Requires LINKEDIN_CLIENT_ID + LINKEDIN_CLIENT_SECRET env vars.
 *   - Instagram: Instagram Basic Display API was deprecated in 2025.
 *     Use Instagram Graph API via a Facebook App in Advanced Access (requires App Review).
 *   - Twitter/YouTube: Standard OAuth2 flows, pending provider app setup.
 *
 * The access token is stored encrypted (AES-256-GCM) with the current key version.
 * Interest inference is deferred — inferredInterests starts empty and is populated
 * by a future /api/consumer/social/sync endpoint.
 */

import 'server-only'

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

const VALID_PLATFORMS: SocialPlatform[] = ['instagram', 'twitter', 'linkedin', 'youtube']

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const role = (session.user as any).role

    if (!userId || role !== 'consumer') {
      return NextResponse.json({ error: 'Consumer access only' }, { status: 403 })
    }

    const body = await req.json().catch(() => null)

    if (!body?.platform || !VALID_PLATFORMS.includes(body.platform)) {
      return NextResponse.json(
        { error: `Missing or invalid platform. Must be one of: ${VALID_PLATFORMS.join(', ')}` },
        { status: 400 }
      )
    }

    if (!body?.accessToken || typeof body.accessToken !== 'string') {
      return NextResponse.json({ error: 'Missing required field: accessToken' }, { status: 400 })
    }

    const platform = body.platform as SocialPlatform

    // Enforce social consent before storing any data
    await enforceConsent(userId, 'social', 'connect_social_account')

    // Look up the active consent record ID for the 'social' category
    // (needed for the FK in consumer_social_connections.consentRecordId)
    const consentRecord = await getConsent(userId, 'social')
    if (!consentRecord) {
      return NextResponse.json(
        { error: 'No active social consent record found. Grant social consent first.' },
        { status: 403 }
      )
    }

    // Reject if already connected (the partial unique index prevents DB duplicates,
    // but give a clear error message instead of a constraint violation)
    const existing = await getActiveConnection(userId, platform)
    if (existing) {
      return NextResponse.json(
        {
          error: `${platform} is already connected. Disconnect it first before reconnecting.`,
          connectedAt: existing.connectedAt,
        },
        { status: 409 }
      )
    }

    // Encrypt the token — store { accessToken, expiresAt } as JSON payload
    const tokenPayload = JSON.stringify({
      accessToken: body.accessToken,
      expiresAt: body.expiresAt ?? null,
    })
    const { encryptedValue, encryptionKeyId } = await encryptForStorage(tokenPayload)

    const connection = await createSocialConnection({
      userId,
      platform,
      encryptedAccessToken: encryptedValue,
      encryptionKeyId,
      consentRecordId: consentRecord.id,
      inferredInterests: {},           // populated by future sync endpoint
      inferenceMethod: 'followed_accounts',
    })

    return NextResponse.json({
      success: true,
      platform,
      connectedAt: connection.connectedAt,
      note: 'Interest inference will be computed on next sync.',
    })
  } catch (error: any) {
    if (error?.name === 'ConsentDeniedError') {
      return NextResponse.json({ error: 'Social consent is required to connect an account.' }, { status: 403 })
    }
    console.error('[Social Connect POST] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
