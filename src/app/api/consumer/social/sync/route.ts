/**
 * Social Interest Sync
 * POST /api/consumer/social/sync
 *
 * Infers interests from connected social accounts and writes them to
 * userProfiles.socialSignals. Each platform's inferredInterests are merged
 * into a single map and stored as { inferredInterests, syncedAt, platforms }.
 *
 * Body: { platform?: string }  — omit to sync all connected platforms
 *
 * Consent required: 'social'
 *
 * Note on real API integration:
 *   Platform API calls are stubs. LinkedIn, Twitter, YouTube, Instagram each
 *   require provider-specific OAuth scopes and API approval. The inferred
 *   interests on the connection row (inferredInterests JSONB) will be
 *   populated by provider-specific logic once those integrations are live.
 *   Until then, this route uses the stored inferredInterests from the DB row
 *   (which starts empty and must be seeded via a separate provider integration).
 *
 * Design:
 *   - Fetches active connections for the user
 *   - Merges inferredInterests across all (or one) platform(s) — higher score wins
 *   - Writes merged map to userProfiles.socialSignals
 *   - Updates lastSyncedAt on the connection row(s)
 */

import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { enforceConsent } from '@/lib/consent-enforcement'
import { db } from '@/db'
import { userProfiles } from '@/db/schema'
import { eq } from 'drizzle-orm'
import {
  getActiveSocialConnections,
  upsertInferredInterests,
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

    // Enforce social consent before reading or updating social data
    await enforceConsent(userId, 'social', 'connect_social_account')

    // Parse optional platform filter
    const body = await req.json().catch(() => ({}))
    const platformFilter: SocialPlatform | null =
      body?.platform && VALID_PLATFORMS.includes(body.platform) ? body.platform : null

    // Load all active connections
    const connections = await getActiveSocialConnections(userId)

    if (connections.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No connected social accounts found.',
        syncedPlatforms: [],
        inferredInterests: {},
      })
    }

    const filtered = platformFilter
      ? connections.filter(c => c.platform === platformFilter)
      : connections

    if (filtered.length === 0) {
      return NextResponse.json(
        { error: `Platform '${platformFilter}' is not connected.` },
        { status: 404 }
      )
    }

    // Merge inferredInterests across platforms — take the max score for each interest key
    // when the same interest appears in multiple platforms.
    const merged: Record<string, number> = {}
    const syncedPlatforms: string[] = []

    for (const conn of filtered) {
      const interests = (conn.inferredInterests as Record<string, number> | null) ?? {}

      for (const [key, score] of Object.entries(interests)) {
        if (typeof score === 'number') {
          merged[key] = Math.max(merged[key] ?? 0, score)
        }
      }

      // Touch lastSyncedAt on this connection row
      await upsertInferredInterests(conn.id, userId, interests)
      syncedPlatforms.push(conn.platform)
    }

    // Write merged social signals to userProfiles
    const socialSignals = {
      inferredInterests: merged,
      syncedAt: new Date().toISOString(),
      platforms: syncedPlatforms,
    }

    await db
      .update(userProfiles)
      .set({ socialSignals })
      .where(eq(userProfiles.id, userId))

    return NextResponse.json({
      success: true,
      message: `Synced ${syncedPlatforms.length} platform(s).`,
      syncedPlatforms,
      inferredInterestCount: Object.keys(merged).length,
      note: Object.keys(merged).length === 0
        ? 'No interests inferred yet — provider API integration is pending.'
        : undefined,
    })

  } catch (error: any) {
    if (error?.name === 'ConsentDeniedError') {
      return NextResponse.json(
        { error: 'Social consent is required to sync social accounts.' },
        { status: 403 }
      )
    }
    console.error('[Social Sync POST] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
