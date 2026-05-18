import { eq, and, or, ilike, sql, ne, lte } from 'drizzle-orm'
import { db } from '@/db'
import { products } from '@/db/schema'
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
  }
}

/**
 * Convert app Product to database format
 */
function toDBProduct(product: Partial<Product>): Partial<NewProduct> {
  const result: Partial<NewProduct> = {
    id: product.id,
    name: product.name,
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
 * Get all products (excludes merged AND scheduled by default).
 *
 * Scheduled products are owner-only — they should not appear in rankings,
 * top-products, public listings, or consumer-side discovery surfaces. The
 * cron at /api/cron/publish-scheduled-launches flips launch_status to
 * 'live' when the scheduled time arrives, at which point they reappear
 * here. Pass `{ includeScheduled: true }` for admin / debugging surfaces.
 */
export async function getAllProducts(opts?: { includeScheduled?: boolean }): Promise<Product[]> {
  const conditions: any[] = [ne(products.lifecycleStatus, 'merged')]
  if (!opts?.includeScheduled) {
    conditions.push(eq(products.launchStatus, 'live'))
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
 * Get claimable products (pending verification, not yet claimed)
 */
export async function getClaimableProducts(): Promise<Product[]> {
  const results = await db
    .select()
    .from(products)
    .where(
      and(
        eq(products.claimable, true),
        eq(products.lifecycleStatus, 'pending_verification')
      )
    )
  return results.map(toProduct)
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
export async function claimProduct(
  productId: string,
  claimedBy: string
): Promise<Product | null> {
  const product = await getProductById(productId)
  if (!product) return null
  if (!product.claimable) return null
  if (product.lifecycleStatus === 'merged') return null
  
  const [updated] = await db
    .update(products)
    .set({
      ownerId: claimedBy,
      claimedBy,
      claimedAt: new Date(),
      claimable: false,
      lifecycleStatus: 'verified',
      updatedAt: new Date(),
    })
    .where(eq(products.id, productId))
    .returning()
  
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
