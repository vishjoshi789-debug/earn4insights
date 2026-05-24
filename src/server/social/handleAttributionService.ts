/**
 * Handle Attribution Service
 *
 * Resolves a social post's author back to a verified E4I user. Strictly
 * opt-in: only OAuth-captured verified_handle / verified_subject
 * participate. Self-declared values are NEVER used.
 *
 * Returns null on:
 *   - no input identifier (no handle AND no subject)
 *   - no row in consumer_social_connections for the platform+identifier
 *   - the row is revoked (revoked_at IS NOT NULL)
 *   - more than one active row matches (data anomaly — refuse to guess)
 *
 * Within a single ingestion batch, callers should reuse one
 * AttributionCache instance so a batch of 100 mentions by 5 distinct
 * authors costs 5 DB queries, not 100.
 */

import 'server-only'

import { db } from '@/db'
import { consumerSocialConnections } from '@/db/schema'
import { and, eq, isNull, sql } from 'drizzle-orm'

export type AttributionInput = {
  platform: string
  authorHandle?: string | null    // e.g. 'u/lalit' or '@lalit' or 'lalit_yt'
  authorSubject?: string | null   // platform-canonical id, e.g. 'urn:li:person:abc123'
}

// ────────────────────────────────────────────────────────────────────
// Per-batch memoisation. Keyed by `${platform}|${handle?}|${subject?}`
// so two posts by the same author within one batch resolve once.
// Negative results are cached too — a missing connection won't appear
// mid-batch, and the second-look query would be wasted.
// ────────────────────────────────────────────────────────────────────
export class AttributionCache {
  private cache = new Map<string, string | null>()

  /** Returns the matched userId, or null. Never throws. */
  async resolve(input: AttributionInput): Promise<string | null> {
    const platform = (input.platform || '').trim()
    const handle = input.authorHandle?.trim() || null
    const subject = input.authorSubject?.trim() || null

    if (!platform) return null
    if (!handle && !subject) return null

    const key = `${platform}|${handle ?? ''}|${subject ?? ''}`
    if (this.cache.has(key)) return this.cache.get(key)!

    const userId = await lookupVerified(platform, handle, subject)
    this.cache.set(key, userId)
    return userId
  }
}

/**
 * The actual DB lookup. Subject path is preferred (opaque immutable
 * id); falls back to case-insensitive handle match. Both paths require
 * exact platform match and active (non-revoked) row. LIMIT 2 lets us
 * detect duplicate active rows for the same identifier — we refuse to
 * pick a winner in that case.
 *
 * Index coverage (from migration 020 — partial indexes both `WHERE
 * verified_* IS NOT NULL AND revoked_at IS NULL`):
 *   - idx_csc_platform_subject (platform, verified_subject)
 *   - idx_csc_platform_handle  (platform, LOWER(verified_handle))
 */
async function lookupVerified(
  platform: string,
  handle: string | null,
  subject: string | null,
): Promise<string | null> {
  try {
    if (subject) {
      const rows = await db
        .select({ userId: consumerSocialConnections.userId })
        .from(consumerSocialConnections)
        .where(
          and(
            eq(consumerSocialConnections.platform, platform as any),
            eq(consumerSocialConnections.verifiedSubject, subject),
            isNull(consumerSocialConnections.revokedAt),
          ),
        )
        .limit(2)

      if (rows.length === 1) return rows[0].userId
      if (rows.length > 1) {
        console.warn(
          '[handleAttribution] duplicate active rows for platform=%s subject=%s — refusing to attribute',
          platform, subject,
        )
        return null
      }
      // Zero subject matches — fall through to handle match if available.
    }

    if (handle) {
      const rows = await db
        .select({ userId: consumerSocialConnections.userId })
        .from(consumerSocialConnections)
        .where(
          and(
            eq(consumerSocialConnections.platform, platform as any),
            sql`LOWER(${consumerSocialConnections.verifiedHandle}) = LOWER(${handle})`,
            isNull(consumerSocialConnections.revokedAt),
          ),
        )
        .limit(2)

      if (rows.length === 1) return rows[0].userId
      if (rows.length > 1) {
        console.warn(
          '[handleAttribution] duplicate active rows for platform=%s handle=%s — refusing to attribute',
          platform, handle,
        )
        return null
      }
    }

    return null
  } catch (err) {
    // DB hiccup or schema mismatch (e.g. migration 020 hasn't run) —
    // surface in logs but never throw out of the attribution path.
    console.error('[handleAttribution] lookup error:', err)
    return null
  }
}

/**
 * One-shot helper for callers that only resolve a single post and
 * don't need batch memoisation. Equivalent to:
 *     new AttributionCache().resolve(input)
 */
export async function resolveAuthorToUser(
  input: AttributionInput,
): Promise<string | null> {
  return new AttributionCache().resolve(input)
}
