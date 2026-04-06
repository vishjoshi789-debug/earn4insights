/**
 * Social Connection Repository
 *
 * DB layer for consumer_social_connections table.
 * Handles encrypted OAuth token storage for connected social accounts.
 *
 * Design notes:
 * - Access tokens are stored encrypted (AES-256-GCM via encryptForStorage).
 * - The encrypted payload is JSON: { accessToken, expiresAt } so expiry is
 *   tracked without a dedicated column.
 * - Revocation sets revokedAt and nullifies token fields — the row is retained
 *   for consent audit trail purposes.
 * - consentRecordId is a hard FK to consent_records — a social connection cannot
 *   exist without an active 'social' consent record.
 */

import 'server-only'

import { db } from '@/db'
import { consumerSocialConnections } from '@/db/schema'
import { and, eq, isNull } from 'drizzle-orm'
import type { ConsumerSocialConnection } from '@/db/schema'

// ── Types ─────────────────────────────────────────────────────────

export type SocialPlatform = 'instagram' | 'twitter' | 'linkedin' | 'youtube'

export type CreateConnectionInput = {
  userId: string
  platform: SocialPlatform
  encryptedAccessToken: string
  encryptionKeyId: string
  consentRecordId: string
  inferredInterests?: Record<string, number>
  inferenceMethod?: 'followed_accounts' | 'public_profile_analysis'
}

// ── Read ─────────────────────────────────────────────────────────

/**
 * Returns all non-revoked social connections for a user.
 */
export async function getActiveSocialConnections(
  userId: string
): Promise<ConsumerSocialConnection[]> {
  return db
    .select()
    .from(consumerSocialConnections)
    .where(
      and(
        eq(consumerSocialConnections.userId, userId),
        isNull(consumerSocialConnections.revokedAt)
      )
    )
}

/**
 * Returns a single active connection for a user+platform, or null.
 */
export async function getActiveConnection(
  userId: string,
  platform: SocialPlatform
): Promise<ConsumerSocialConnection | null> {
  const rows = await db
    .select()
    .from(consumerSocialConnections)
    .where(
      and(
        eq(consumerSocialConnections.userId, userId),
        eq(consumerSocialConnections.platform, platform),
        isNull(consumerSocialConnections.revokedAt)
      )
    )
    .limit(1)
  return rows[0] ?? null
}

// ── Write ────────────────────────────────────────────────────────

/**
 * Inserts a new social connection record.
 * Call after successfully exchanging an OAuth code for a token.
 */
export async function createSocialConnection(
  input: CreateConnectionInput
): Promise<ConsumerSocialConnection> {
  const rows = await db
    .insert(consumerSocialConnections)
    .values({
      userId: input.userId,
      platform: input.platform,
      encryptedAccessToken: input.encryptedAccessToken,
      encryptionKeyId: input.encryptionKeyId,
      consentRecordId: input.consentRecordId,
      inferredInterests: input.inferredInterests ?? {},
      inferenceMethod: input.inferenceMethod ?? 'followed_accounts',
      connectedAt: new Date(),
    })
    .returning()
  return rows[0]
}

/**
 * Revokes a social connection: sets revokedAt, nullifies encrypted token.
 * The row is preserved for audit purposes.
 */
export async function revokeSocialConnection(
  userId: string,
  platform: SocialPlatform
): Promise<void> {
  await db
    .update(consumerSocialConnections)
    .set({
      revokedAt: new Date(),
      encryptedAccessToken: null,
      encryptionKeyId: null,
    })
    .where(
      and(
        eq(consumerSocialConnections.userId, userId),
        eq(consumerSocialConnections.platform, platform),
        isNull(consumerSocialConnections.revokedAt)
      )
    )
}

/**
 * Updates inferred interests for a connection (called after sync/analysis).
 */
export async function upsertInferredInterests(
  connectionId: string,
  userId: string,
  interests: Record<string, number>
): Promise<void> {
  await db
    .update(consumerSocialConnections)
    .set({
      inferredInterests: interests,
      lastSyncedAt: new Date(),
    })
    .where(
      and(
        eq(consumerSocialConnections.id, connectionId),
        eq(consumerSocialConnections.userId, userId)
      )
    )
}
