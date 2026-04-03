import 'server-only'

import { db } from '@/db'
import {
  brandIcps,
  icpMatchScores,
  type BrandIcp,
  type NewBrandIcp,
  type IcpMatchScore,
  type NewIcpMatchScore,
} from '@/db/schema'
import { eq, and, gte, desc, sql } from 'drizzle-orm'

// ── ICP attribute types ───────────────────────────────────────────

export type IcpCriterion = {
  values: string[]
  weight: number           // must sum to 100 across all criteria
  required: boolean
  requiresConsentCategory?: string  // e.g. 'psychographic' | 'sensitive_dietary'
}

export type IcpAttributes = {
  version: string          // '1.0'
  criteria: Record<string, IcpCriterion>
  totalWeight: number      // must equal 100
}

export type IcpMatchBreakdown = {
  criteriaScores: Record<string, {
    earned: number
    max: number
    matched?: string | string[]
    reason?: string
  }>
  totalEarned: number
  totalPossible: number
  consentGaps: string[]
  explainability: string
}

// ── ICP CRUD ──────────────────────────────────────────────────────

/**
 * Create a new ICP for a brand.
 *
 * Throws if attributes.totalWeight !== 100.
 * This is a hard validation — ICPs with wrong weight sums produce
 * meaningless match scores and misleading alerts.
 */
export async function createIcp(
  brandId: string,
  data: {
    productId?: string
    name: string
    description?: string
    attributes: IcpAttributes
    matchThreshold?: number
  }
): Promise<BrandIcp> {
  validateIcpWeights(data.attributes)

  const [row] = await db
    .insert(brandIcps)
    .values({
      brandId,
      productId: data.productId ?? null,
      name: data.name,
      description: data.description ?? null,
      attributes: data.attributes,
      matchThreshold: data.matchThreshold ?? 60,
      isActive: true,
    } satisfies Omit<NewBrandIcp, 'id' | 'createdAt' | 'updatedAt'>)
    .returning()

  return row
}

/**
 * Get a single ICP by ID.
 */
export async function getIcpById(icpId: string): Promise<BrandIcp | null> {
  const rows = await db
    .select()
    .from(brandIcps)
    .where(eq(brandIcps.id, icpId))
    .limit(1)

  return rows[0] ?? null
}

/**
 * Get all ICPs for a brand.
 */
export async function getIcpsByBrand(
  brandId: string,
  options?: { activeOnly?: boolean }
): Promise<BrandIcp[]> {
  const conditions = [eq(brandIcps.brandId, brandId)]

  if (options?.activeOnly !== false) {
    conditions.push(eq(brandIcps.isActive, true))
  }

  return db
    .select()
    .from(brandIcps)
    .where(and(...conditions))
    .orderBy(desc(brandIcps.createdAt))
}

/**
 * Get active ICPs for a brand that apply to a specific product.
 * Returns both product-specific ICPs (productId = given) and brand-wide ICPs (productId IS NULL).
 */
export async function getActiveIcpsForProduct(
  brandId: string,
  productId: string
): Promise<BrandIcp[]> {
  return db
    .select()
    .from(brandIcps)
    .where(
      and(
        eq(brandIcps.brandId, brandId),
        eq(brandIcps.isActive, true),
        sql`(${brandIcps.productId} = ${productId} OR ${brandIcps.productId} IS NULL)`
      )
    )
}

/**
 * Update an ICP's attributes or settings.
 * Throws if new attributes.totalWeight !== 100.
 * Also marks all existing match scores for this ICP as stale —
 * attribute changes invalidate all cached scores.
 */
export async function updateIcp(
  icpId: string,
  data: Partial<{
    name: string
    description: string
    attributes: IcpAttributes
    matchThreshold: number
  }>
): Promise<BrandIcp> {
  if (data.attributes) {
    validateIcpWeights(data.attributes)
  }

  const [updated] = await db
    .update(brandIcps)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(brandIcps.id, icpId))
    .returning()

  if (!updated) {
    throw new Error(`ICP not found: ${icpId}`)
  }

  // Attribute changes invalidate all cached match scores for this ICP
  if (data.attributes) {
    await markScoresStaleByIcp(icpId)
  }

  return updated
}

/**
 * Deactivate an ICP. Does not delete — preserves audit history.
 */
export async function deactivateIcp(icpId: string): Promise<void> {
  await db
    .update(brandIcps)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(brandIcps.id, icpId))
}

// ── Match score reads ─────────────────────────────────────────────

/**
 * Get the cached match score for a specific ICP + consumer pair.
 * Returns null if not yet computed.
 */
export async function getMatchScore(
  icpId: string,
  consumerId: string
): Promise<IcpMatchScore | null> {
  const rows = await db
    .select()
    .from(icpMatchScores)
    .where(
      and(
        eq(icpMatchScores.icpId, icpId),
        eq(icpMatchScores.consumerId, consumerId)
      )
    )
    .limit(1)

  return rows[0] ?? null
}

/**
 * Get the top-matching consumers for an ICP above a minimum score.
 * Only returns non-stale scores.
 */
export async function getTopMatchesForIcp(
  icpId: string,
  options?: {
    minScore?: number
    limit?: number
  }
): Promise<IcpMatchScore[]> {
  const minScore = options?.minScore ?? 0
  const limit = options?.limit ?? 50

  return db
    .select()
    .from(icpMatchScores)
    .where(
      and(
        eq(icpMatchScores.icpId, icpId),
        eq(icpMatchScores.isStale, false),
        gte(icpMatchScores.matchScore, minScore)
      )
    )
    .orderBy(desc(icpMatchScores.matchScore))
    .limit(limit)
}

/**
 * Get all stale match scores — used by the daily recompute cron.
 */
export async function getStaleScores(options?: { limit?: number }): Promise<IcpMatchScore[]> {
  return db
    .select()
    .from(icpMatchScores)
    .where(eq(icpMatchScores.isStale, true))
    .orderBy(icpMatchScores.computedAt)
    .limit(options?.limit ?? 200)
}

// ── Match score writes ────────────────────────────────────────────

/**
 * Upsert a match score for an ICP + consumer pair.
 * If a row already exists, updates it and clears isStale.
 * Pattern: called after scoring engine computes a new score.
 */
export async function upsertMatchScore(
  icpId: string,
  consumerId: string,
  matchScore: number,
  breakdown: IcpMatchBreakdown
): Promise<IcpMatchScore> {
  const now = new Date()

  const [row] = await db
    .insert(icpMatchScores)
    .values({
      icpId,
      consumerId,
      matchScore,
      breakdown,
      computedAt: now,
      isStale: false,
    } satisfies Omit<NewIcpMatchScore, 'id'>)
    .onConflictDoUpdate({
      target: [icpMatchScores.icpId, icpMatchScores.consumerId],
      set: {
        matchScore,
        breakdown,
        computedAt: now,
        isStale: false,
      },
    })
    .returning()

  return row
}

// ── Staleness management ──────────────────────────────────────────

/**
 * Mark all cached match scores for a consumer as stale.
 * Called when:
 *   - Consumer submits feedback
 *   - Consumer updates their profile or signals
 *   - Daily cron (age > 24h)
 *
 * Returns the number of rows marked stale.
 */
export async function markScoresStaleByConsumer(consumerId: string): Promise<number> {
  const updated = await db
    .update(icpMatchScores)
    .set({ isStale: true })
    .where(
      and(
        eq(icpMatchScores.consumerId, consumerId),
        eq(icpMatchScores.isStale, false)
      )
    )
    .returning({ id: icpMatchScores.id })

  return updated.length
}

/**
 * Mark all cached match scores for an ICP as stale.
 * Called when brand edits the ICP's attributes.
 *
 * Returns the number of rows marked stale.
 */
export async function markScoresStaleByIcp(icpId: string): Promise<number> {
  const updated = await db
    .update(icpMatchScores)
    .set({ isStale: true })
    .where(
      and(
        eq(icpMatchScores.icpId, icpId),
        eq(icpMatchScores.isStale, false)
      )
    )
    .returning({ id: icpMatchScores.id })

  return updated.length
}

// ── Internal validation ───────────────────────────────────────────

/**
 * Validate that ICP criteria weights sum to exactly 100.
 * Throws a hard error — ICPs with wrong totals are rejected at write time.
 *
 * This prevents silent score drift where scores appear valid but are
 * computed against a misconfigured ICP.
 */
function validateIcpWeights(attributes: IcpAttributes): void {
  const criteriaEntries = Object.values(attributes.criteria)
  const actualTotal = criteriaEntries.reduce((sum, c) => sum + c.weight, 0)

  if (actualTotal !== 100) {
    throw new Error(
      `ICP weight validation failed: criteria weights must sum to exactly 100, ` +
      `got ${actualTotal}. ` +
      `Check: ${JSON.stringify(
        Object.fromEntries(
          Object.entries(attributes.criteria).map(([k, v]) => [k, v.weight])
        )
      )}`
    )
  }

  if (attributes.totalWeight !== 100) {
    throw new Error(
      `ICP weight validation failed: attributes.totalWeight must be 100, ` +
      `got ${attributes.totalWeight}`
    )
  }
}
