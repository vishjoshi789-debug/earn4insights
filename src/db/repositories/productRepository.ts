import { eq, and, or, ilike, sql, ne, lte, isNull } from 'drizzle-orm'
import { db } from '@/db'
import { products } from '@/db/schema'
import type { DbTx } from '@/db/tx'
import { rekeyBrandForProduct } from './brandKeyRepository'
import type { Product as DBProduct, NewProduct } from '@/db/schema'
import type { Product, ProductProfile, ProductLifecycleStatus, ProductCreationSource, ProductLaunchStatus } from '@/lib/types/product'

/**
 * Convert database product to app Product type
 */
function toProduct(dbProduct: DBProduct): Product {
  return {
    id: dbProduct.id,
    name: dbProduct.name,
    description: dbProduct.description || undefined,
    platform: dbProduct.platform || undefined,
    created_at: dbProduct.createdAt.toISOString(),
    updated_at: dbProduct.updatedAt?.toISOString(),
    features: {
      nps: dbProduct.npsEnabled,
      feedback: dbProduct.feedbackEnabled,
      social_listening: dbProduct.socialListeningEnabled,
    },
    profile: dbProduct.profile as ProductProfile,
    // Phase 5: Lifecycle fields
    lifecycleStatus: (dbProduct.lifecycleStatus || 'verified') as ProductLifecycleStatus,
    ownerId: dbProduct.ownerId || undefined,
    claimable: dbProduct.claimable || false,
    claimedAt: dbProduct.claimedAt?.toISOString(),
    claimedBy: dbProduct.claimedBy || undefined,
    mergedIntoId: dbProduct.mergedIntoId || undefined,
    mergedAt: dbProduct.mergedAt?.toISOString(),
    createdBy: dbProduct.createdBy || undefined,
    creationSource: (dbProduct.creationSource || 'brand_onboarding') as ProductCreationSource,
    nameNormalized: dbProduct.nameNormalized || undefined,
    launchStatus: (dbProduct.launchStatus || 'live') as ProductLaunchStatus,
    scheduledLaunchAt: dbProduct.scheduledLaunchAt?.toISOString(),
    revealBeforeLaunch: dbProduct.revealBeforeLaunch,
  }
}

/**
 * Convert app Product to database format
 */
function toDBProduct(product: Partial<Product>): Partial<NewProduct> {
  const result: Partial<NewProduct> = {
    id: product.id,
    // ⚠️ Trimmed HERE, at the one write chokepoint for create AND update.
    // Names were stored with trailing whitespace — "Insights " produced the
    // notification title "Insights  is now live" with a double space, the
    // second instance after the "Josiah Okoku " user name. nameNormalized
    // already trimmed; the display name did not.
    name: product.name?.trim(),
    description: product.description,
    platform: product.platform,
    npsEnabled: product.features?.nps ?? false,
    feedbackEnabled: product.features?.feedback ?? false,
    socialListeningEnabled: product.features?.social_listening ?? false,
    profile: product.profile as any,
  }
  
  // Include lifecycle fields when provided
  if (product.lifecycleStatus !== undefined) result.lifecycleStatus = product.lifecycleStatus
  if (product.ownerId !== undefined) result.ownerId = product.ownerId
  if (product.claimable !== undefined) result.claimable = product.claimable
  if (product.createdBy !== undefined) result.createdBy = product.createdBy
  if (product.creationSource !== undefined) result.creationSource = product.creationSource
  if (product.launchStatus !== undefined) result.launchStatus = product.launchStatus
  if (product.revealBeforeLaunch !== undefined) result.revealBeforeLaunch = product.revealBeforeLaunch
  if (product.scheduledLaunchAt !== undefined) {
    result.scheduledLaunchAt = product.scheduledLaunchAt ? new Date(product.scheduledLaunchAt) : null
  }
  if (product.name) result.nameNormalized = product.name.toLowerCase().trim()

  return result
}

// ============================================================================
// BASIC CRUD (existing, backward compatible)
// ============================================================================

/**
 * THE ONE PREDICATE for "may a consumer see this product?"
 *
 *   live, OR scheduled AND the brand opted to reveal it as Coming Soon.
 *
 * ⚠️ Every consumer-facing product read MUST use this, or the brand's
 * reveal_before_launch choice is a hidden button rather than a hidden product.
 * Before this existed, /dashboard/recommendations and personalizationEngine
 * did bare selects with no launch filter at all, so a scheduled product would
 * have appeared in "For You" even with reveal OFF. One predicate, every call
 * site, so they cannot drift — the same rule as parseFeedbackFilters.
 *
 * Does NOT filter lifecycleStatus; callers add ne(lifecycleStatus, 'merged')
 * as they already do, because "merged" is a different question from "visible".
 */
export function consumerVisibleProducts() {
  return or(
    eq(products.launchStatus, 'live'),
    and(eq(products.launchStatus, 'scheduled'), eq(products.revealBeforeLaunch, true)),
  )
}

/**
 * ⚠️⚠️ THE ONE DEFINITION OF "CLAIMABLE". EVERY CALLER READS THIS LINE.
 *
 * The brand-facing search, the single-product eligibility check, and the
 * ownership UPDATE inside `claimProduct` all apply THIS predicate. They cannot
 * disagree, because there is nothing to disagree with.
 *
 * ── WHY IT IS A PREDICATE AND NOT ALSO A TS BOOLEAN ──────────────────────
 * A matching `isProductClaimable(product)` helper was considered and REJECTED:
 * two expressions of one rule is the problem, not the solution. A future
 * condition gets added to the SQL and not the boolean, nothing errors, and the
 * search starts offering products the approval will refuse — a false affordance
 * hitting a prospective paying brand at their first real interaction.
 *
 * So there is no boolean. To ask "is THIS product claimable?", call
 * `getClaimableProductById()`, which applies this same predicate with an id
 * filter. One rule, read three ways, defined once. Same consolidation as
 * `MIN_COHORT_SIZE`.
 *
 * ── WHY ALL THREE CONDITIONS, AND WHY NONE IS REDUNDANT ──────────────────
 *
 * `claimable = true` — "offered to the claim flow at all", NOT "unclaimed".
 *   The column defaults to FALSE (`schema.ts`), so brand-launched products are
 *   never claimable; only `createPlaceholderProduct` sets it true. It is the
 *   opt-in, and it is what excludes test/internal products by construction.
 *
 * `owner_id IS NULL` — "not yet claimed". NOT implied by the above: the Group C
 *   reassignment set `owner_id` directly in SQL without touching `claimable`,
 *   so a product can be owned AND still flagged claimable. Without this, those
 *   rows would appear in the search and fail on approval.
 *
 * `lifecycle_status = 'pending_verification'` — only consumer-created
 *   placeholders. Also excludes `'merged'` for free. Moves together with
 *   `claimable` in code (`createPlaceholderProduct`, `claimProduct`,
 *   `mergeProduct` all set both), but manual SQL can desync them — as Group C
 *   proved — so it is asserted rather than assumed.
 *
 * ✅ `claimProduct` sets `claimable: false` in the same `.set()` as `ownerId`,
 * so a successful claim removes the product from this predicate on both counts.
 */
export function claimableProductCondition() {
  return and(
    eq(products.claimable, true),
    isNull(products.ownerId),
    eq(products.lifecycleStatus, 'pending_verification'),
  )
}

/**
 * One claimable product by id, or null. **This is how you ask "is this product
 * claimable?"** — it applies `claimableProductCondition()`, so the answer can
 * never drift from what the search lists or what the approval will accept.
 *
 * ⚠️ A null result means "not claimable", which includes "does not exist".
 * Callers that need to tell those apart for a user-facing message do a separate
 * `getProductById` AFTERWARDS — that is a message concern, not an eligibility
 * decision, and it must not re-implement the rule.
 */
export async function getClaimableProductById(id: string): Promise<Product | null> {
  const rows = await db
    .select()
    .from(products)
    .where(and(eq(products.id, id), claimableProductCondition()))
    .limit(1)
  return rows[0] ? toProduct(rows[0]) : null
}

/**
 * The brand-facing claimable list, optionally filtered by name.
 *
 * Built as SEARCH-AND-CONFIRM, not a discovery feed: at the time of writing all
 * 8 claimable products carry 1–2 feedback items, so a count column would read
 * "Fewer than 5" on every row and rank nothing. A brand arrives looking for
 * their OWN product. An empty query returns everything, because 8 is browsable
 * and an empty box that reveals nothing reads as a broken feature.
 *
 * ⚠️ This lets any brand enumerate consumer-created product names. Already true
 * of `/dashboard/products` (§11 — productIds are enumerable by design), so no
 * new exposure, but it is now a SECOND surface with that property: closing the
 * first without closing this one would be a false fix.
 */
export async function listClaimableProducts(search?: string): Promise<Product[]> {
  const conditions = [claimableProductCondition()]
  const q = search?.trim().toLowerCase()
  if (q) conditions.push(ilike(products.name, `%${q}%`))

  const rows = await db
    .select()
    .from(products)
    .where(and(...conditions))
    .orderBy(products.name)
    .limit(50)

  return rows.map(toProduct)
}

export async function getAllProducts(opts?: { includeScheduled?: boolean }): Promise<Product[]> {
  const conditions: any[] = [ne(products.lifecycleStatus, 'merged')]
  if (!opts?.includeScheduled) {
    // Consumer catalog: live + revealed-Coming-Soon. includeScheduled is the
    // owner/admin view and skips the visibility predicate entirely.
    conditions.push(consumerVisibleProducts())
  }
  const dbProducts = await db
    .select()
    .from(products)
    .where(and(...conditions))
  return dbProducts.map(toProduct)
}

/**
 * Get product by ID
 */
export async function getProductById(id: string): Promise<Product | null> {
  const [dbProduct] = await db.select().from(products).where(eq(products.id, id))
  return dbProduct ? toProduct(dbProduct) : null
}

/**
 * Create new product
 */
export async function createProduct(product: Product): Promise<Product> {
  const dbValues = toDBProduct(product) as NewProduct
  dbValues.nameNormalized = product.name.toLowerCase().trim()
  
  const [created] = await db
    .insert(products)
    .values(dbValues)
    .returning()
  
  return toProduct(created)
}

/**
 * Update product
 */
export async function updateProduct(id: string, updates: Partial<Product>): Promise<Product | null> {
  const dbUpdates = toDBProduct(updates)
  ;(dbUpdates as any).updatedAt = new Date()
  
  const [updated] = await db
    .update(products)
    .set(dbUpdates)
    .where(eq(products.id, id))
    .returning()
  
  return updated ? toProduct(updated) : null
}

/**
 * Update product profile
 */
export async function updateProductProfile(
  id: string,
  profileUpdater: (prev: ProductProfile) => ProductProfile
): Promise<Product | null> {
  const product = await getProductById(id)
  if (!product) return null

  const newProfile = profileUpdater(product.profile)
  
  const [updated] = await db
    .update(products)
    .set({ profile: newProfile as any, updatedAt: new Date() })
    .where(eq(products.id, id))
    .returning()
  
  return updated ? toProduct(updated) : null
}

/**
 * Delete product
 */
export async function deleteProduct(id: string): Promise<boolean> {
  const result = await db.delete(products).where(eq(products.id, id))
  return result.length > 0
}

// ============================================================================
// PHASE 5: SEARCH & DISCOVERY
// ============================================================================

/**
 * Search products by name with fuzzy matching
 * Uses PostgreSQL ILIKE for case-insensitive partial matching
 * and trigram similarity for fuzzy ranking
 */
export async function searchProductsByName(
  query: string,
  options?: {
    limit?: number
    excludeMerged?: boolean
    onlyClaimable?: boolean
    includeScheduled?: boolean
  }
): Promise<Array<Product & { matchScore: number }>> {
  const { limit = 10, excludeMerged = true, onlyClaimable = false, includeScheduled = false } = options || {}

  const normalizedQuery = query.toLowerCase().trim()
  if (!normalizedQuery) return []

  const conditions: any[] = []

  // Partial match using ILIKE
  conditions.push(ilike(products.name, `%${normalizedQuery}%`))

  if (excludeMerged) {
    conditions.push(ne(products.lifecycleStatus, 'merged'))
  }
  if (!includeScheduled) {
    conditions.push(eq(products.launchStatus, 'live'))
  }
  if (onlyClaimable) {
    conditions.push(eq(products.claimable, true))
  }
  
  const results = await db
    .select()
    .from(products)
    .where(and(...conditions))
    .limit(limit)
  
  // Calculate match scores
  return results.map(p => {
    const name = (p.nameNormalized || p.name.toLowerCase()).trim()
    let score = 0
    
    // Exact match = 100
    if (name === normalizedQuery) score = 100
    // Starts with query = 90
    else if (name.startsWith(normalizedQuery)) score = 90
    // Contains query = 70
    else if (name.includes(normalizedQuery)) score = 70
    // Partial word match = 50
    else score = 50
    
    return {
      ...toProduct(p),
      matchScore: score,
    }
  }).sort((a, b) => b.matchScore - a.matchScore)
}

/**
 * Find potential duplicate products
 */
export async function findPotentialDuplicates(
  name: string,
  excludeId?: string
): Promise<Array<Product & { matchScore: number }>> {
  const normalizedName = name.toLowerCase().trim()
  
  // Search for products with similar names
  const conditions: any[] = [
    ne(products.lifecycleStatus, 'merged'),
    or(
      ilike(products.name, `%${normalizedName}%`),
      ilike(products.nameNormalized, `%${normalizedName}%`)
    ),
  ]
  
  if (excludeId) {
    conditions.push(ne(products.id, excludeId))
  }
  
  const results = await db
    .select()
    .from(products)
    .where(and(...conditions))
    .limit(10)
  
  return results.map(p => {
    const pName = (p.nameNormalized || p.name.toLowerCase()).trim()
    let score = 0
    
    if (pName === normalizedName) score = 100
    else if (pName.startsWith(normalizedName) || normalizedName.startsWith(pName)) score = 85
    else if (pName.includes(normalizedName) || normalizedName.includes(pName)) score = 70
    else score = 50
    
    return { ...toProduct(p), matchScore: score }
  }).sort((a, b) => b.matchScore - a.matchScore)
}

// ============================================================================
// PHASE 5: LIFECYCLE MANAGEMENT
// ============================================================================

/**
 * Get products by lifecycle status
 */
export async function getProductsByStatus(
  status: ProductLifecycleStatus
): Promise<Product[]> {
  const results = await db
    .select()
    .from(products)
    .where(eq(products.lifecycleStatus, status))
  return results.map(toProduct)
}

/**
 * Get products by owner
 */
export async function getProductsByOwner(ownerId: string): Promise<Product[]> {
  const results = await db
    .select()
    .from(products)
    .where(
      and(
        eq(products.ownerId, ownerId),
        ne(products.lifecycleStatus, 'merged')
      )
    )
  return results.map(toProduct)
}

/**
 * Get claimable products.
 *
 * 🔴 **THIS FUNCTION ALREADY HAD THE DRIFT.** Its docstring said "not yet
 * claimed" and its predicate did not check `owner_id` — it asserted only
 * `claimable = true AND lifecycle_status = 'pending_verification'`. So it would
 * have listed the Group C products (owner set directly in SQL, `claimable`
 * untouched) as claimable, and every claim on one would have failed at the
 * ownership UPDATE. **A live false affordance waiting for the UI that would
 * have exposed it** — found by consolidating rather than by a bug report.
 *
 * Now delegates to `claimableProductCondition()`. Kept as a thin alias because
 * `/api/dashboard/products/claim` calls it; prefer `listClaimableProducts()`,
 * which supports search.
 */
export async function getClaimableProducts(): Promise<Product[]> {
  return listClaimableProducts()
}

/**
 * Create a placeholder product (consumer-submitted)
 */
export async function createPlaceholderProduct(params: {
  name: string
  description?: string
  category?: string
  categoryName?: string
  createdBy?: string
}): Promise<Product> {
  const id = crypto.randomUUID()
  const now = new Date()
  
  const [created] = await db
    .insert(products)
    .values({
      id,
      name: params.name,
      description: params.description || null,
      nameNormalized: params.name.toLowerCase().trim(),
      lifecycleStatus: 'pending_verification',
      claimable: true,
      createdBy: params.createdBy || null,
      creationSource: 'consumer_feedback',
      npsEnabled: false,
      feedbackEnabled: true,
      socialListeningEnabled: false,
      profile: {
        category: params.category,
        categoryName: params.categoryName,
      } as any,
      createdAt: now,
      updatedAt: now,
    })
    .returning()
  
  return toProduct(created)
}

/**
 * Claim a product (brand takes ownership)
 */
/**
 * The ownership predicate in `claimProduct` did not match — the product was
 * claimed or assigned by some other path between the request and the approval.
 *
 * Thrown rather than returned so it cannot be confused with "product not
 * found", and so it rolls back the caller's transaction: an approval that loses
 * this race must not leave the request marked approved.
 */
export class ProductAlreadyOwnedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ProductAlreadyOwnedError'
  }
}

export async function claimProduct(
  productId: string,
  claimedBy: string,
  /**
   * Run inside an EXISTING transaction instead of opening one.
   *
   * ⚠️⚠️ **THE CALLER OWNS THE BOUNDARY. DO NOT NEST.**
   *
   * `approveClaim` must flip the request status and move ownership together, so
   * it opens the transaction and passes the handle here. Wrapping ANOTHER
   * `db.transaction()` around this one does not error — postgres.js turns the
   * inner one into a SAVEPOINT — which is exactly why it is dangerous: the
   * nesting silently becomes something nobody reasoned about, and the inner
   * "commit" is not one.
   *
   * Same contract as `deductPoints` (`pointsService.ts:217`) and
   * `createRedemption`: `existingTx ? run(existingTx) : db.transaction(run)`.
   *
   * ⚠️ The guards below run OUTSIDE the boundary even when a tx is passed, so
   * there is a TOCTOU window between reading `claimable` and writing it.
   * Accepted as a known gap, not an oversight: at admin-queue volume it is
   * negligible, and the real serialization points are the `claimable = false`
   * write inside the transaction plus migration 044's partial unique index on
   * open requests.
   */
  existingTx?: DbTx,
): Promise<Product | null> {
  // ⚠️ NO PRE-READ, NO MANUAL GUARDS. There used to be
  //   `if (!product.claimable) return null; if (lifecycleStatus === 'merged') …`
  // here, and that was a SECOND definition of claimability sitting next to the
  // one in the UPDATE below — exactly the drift this consolidation removes.
  // The conditional UPDATE is the only check, and it is atomic, which
  // check-then-act never was.

  // ⚠️ OWNERSHIP AND BRAND KEYS MOVE TOGETHER, OR NEITHER MOVES.
  //
  // Setting `owner_id` alone is not a claim — it is half of one. Ten tables
  // carry a `brand_id` pointing at whoever owns this product, every reader
  // scopes by that column alone, and nothing reconciles the two. A claim that
  // updated only `owner_id` would hand the brand a product whose alerts, ICPs,
  // deals and contribution events remain invisible to them and dangling for
  // the previous owner — silently, on EVERY claim.
  //
  // So both writes share one commit boundary. If the re-key throws, the
  // ownership change rolls back with it and the claim fails loudly: a
  // half-claimed product is worse than an unclaimed one, because nothing
  // downstream can tell it happened.
  //
  // ── What is actually verified about `db.transaction()` on the pooler ─────
  //
  // ✅ COMMIT is proven by data: the 2026-08-23 row in `payment_redemptions` is
  //    the output of the transaction at `api/consumer/rewards/redeem/route.ts:154`,
  //    on production, through the pgBouncer pooler. (⚠️ Note the naming trap —
  //    `rewardRedemptionRepository` writes `payment_redemptions`, NOT
  //    `reward_redemptions`, which has 0 rows ever.)
  //
  // ⚠️ ROLLBACK is a DIFFERENT behaviour and pgBouncer in transaction mode can
  //    break it while commit looks fine. `scripts/probe-transaction-rollback.ts`
  //    settles it against the pooled endpoint. An earlier version of this
  //    comment claimed the redeem route "has run this way in production" as
  //    though that proved both — it proves commit only.
  //
  // CLAUDE.md's transaction warning is about `pgClient.unsafe()` with inline
  // BEGIN/COMMIT, which is a different mechanism from this.
  const run = async (tx: DbTx) => {
    const [row] = await tx
      .update(products)
      .set({
        ownerId: claimedBy,
        claimedBy,
        claimedAt: new Date(),
        claimable: false,
        lifecycleStatus: 'verified',
        updatedAt: new Date(),
      })
      // ⚠️⚠️ CONDITIONAL, NOT UNCONDITIONAL. The predicate IS the race guard.
      //
      // 044's partial unique index stops two OPEN REQUESTS on one product. It
      // does not stop this sequence:
      //
      //   request created → product claimed by another route (admin assignment,
      //   a direct owner_id write, the legacy claim path) → this request
      //   approved → ownership SILENTLY OVERWRITTEN
      //
      // Same failure, different way in. Re-reading `claimable` above and then
      // writing here is check-then-act; only the predicate is atomic.
      //
      // ✅ Reads `claimableProductCondition()` — THE SAME LINE the brand-facing
      // search and `getClaimableProductById` read. That is the point: a product
      // the search offers is a product this UPDATE will accept, not by two
      // authors agreeing but because there is one definition.
      .where(and(eq(products.id, productId), claimableProductCondition()))
      .returning()

    // No row means the predicate did not match — someone got there first.
    // ⚠️ THROW, do not return null. A null here would be indistinguishable from
    // "product not found" and would let the caller treat a lost race as a soft
    // failure. Throwing also rolls the caller's transaction back, so an
    // approval that loses the race does not leave the request marked approved.
    if (!row) {
      throw new ProductAlreadyOwnedError(
        `Product ${productId} is no longer claimable — it was claimed or assigned ` +
        `by another path after this request was created.`,
      )
    }

    const moved = await rekeyBrandForProduct(productId, claimedBy, tx)
    if (Object.keys(moved).length > 0) {
      console.log(`[claimProduct] re-keyed brand records for ${productId}:`, moved)
    }

    return row
  }

  // Join the caller's transaction when given one; otherwise own the boundary.
  // Reuses the handle rather than nesting, so there is exactly one commit point
  // and no savepoint semantics to reason about.
  const updated = existingTx ? await run(existingTx) : await db.transaction(run)

  return updated ? toProduct(updated) : null
}

/**
 * Merge duplicate product into canonical product
 * Feedback attached to sourceId should be migrated to targetId
 */
export async function mergeProduct(
  sourceId: string,
  targetId: string
): Promise<{ source: Product | null; target: Product | null }> {
  const source = await getProductById(sourceId)
  const target = await getProductById(targetId)
  
  if (!source || !target) return { source: null, target: null }
  if (source.lifecycleStatus === 'merged') return { source: null, target: null }
  
  // Mark source as merged
  const [updatedSource] = await db
    .update(products)
    .set({
      lifecycleStatus: 'merged',
      mergedIntoId: targetId,
      mergedAt: new Date(),
      claimable: false,
      updatedAt: new Date(),
    })
    .where(eq(products.id, sourceId))
    .returning()
  
  return {
    source: updatedSource ? toProduct(updatedSource) : null,
    target,
  }
}

// ============================================================================
// SCHEDULED LAUNCH (migration 016)
// ============================================================================

/**
 * Products owned by a brand that are scheduled to launch in the future.
 * Used by the launch page to show the brand's pending launches so they
 * can see what they've queued up.
 */
export async function getScheduledProductsByOwner(ownerId: string): Promise<Product[]> {
  const rows = await db
    .select()
    .from(products)
    .where(
      and(
        eq(products.ownerId, ownerId),
        eq(products.launchStatus, 'scheduled'),
        ne(products.lifecycleStatus, 'merged'),
      ),
    )
  return rows.map(toProduct)
}

/**
 * Scheduled products whose launch time has arrived (scheduled_launch_at <= now).
 * Called by /api/cron/publish-scheduled-launches; each row is then flipped
 * to launch_status='live' and its launch notifications fired.
 */
export async function getDueScheduledProducts(now: Date = new Date()): Promise<Product[]> {
  const rows = await db
    .select()
    .from(products)
    .where(
      and(
        eq(products.launchStatus, 'scheduled'),
        lte(products.scheduledLaunchAt, now),
        ne(products.lifecycleStatus, 'merged'),
      ),
    )
  return rows.map(toProduct)
}

/**
 * Flip a scheduled product to live. Returns the updated product on success,
 * null if the row was already live (race-safe — second writer is a no-op).
 */
export async function publishScheduledProduct(productId: string): Promise<Product | null> {
  const [updated] = await db
    .update(products)
    .set({ launchStatus: 'live', updatedAt: new Date() })
    .where(
      and(
        eq(products.id, productId),
        eq(products.launchStatus, 'scheduled'),
      ),
    )
    .returning()
  return updated ? toProduct(updated) : null
}
