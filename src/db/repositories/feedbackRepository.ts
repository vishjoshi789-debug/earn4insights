import { db } from '@/db'
import { feedback, feedbackMedia, products, surveyResponses } from '@/db/schema'
import { eq, desc, and, sql, count, inArray, gte, lte, isNotNull } from 'drizzle-orm'

export type FeedbackItem = {
  id: string
  productId: string
  userName: string | null
  userEmail: string | null
  feedbackText: string
  rating: number | null
  sentiment: string | null
  category: string | null
  status: string
  modalityPrimary: string
  processingStatus: string
  originalLanguage: string | null
  normalizedLanguage: string | null
  normalizedText: string | null
  transcriptText: string | null
  createdAt: Date
}

/**
 * Filters for the brand-facing feedback list.
 *
 * Every dimension here maps to a column on `feedback` itself — deliberately no
 * demographic filters (age/gender/geo), which live in `user_profiles` behind an
 * email join and a `demographic` consent record. Don't add them here without
 * routing through the consent gate (see lib/analytics/segmentedAnalytics.ts).
 */
export type FeedbackFilters = {
  status?: string
  sentiment?: string
  modality?: string
  language?: string
  ratingMin?: number
  ratingMax?: number
  dateFrom?: Date
  dateTo?: Date
}

/**
 * Build the WHERE predicate shared by the list and count queries, so
 * "showing X of Y" can never disagree with the rows actually rendered.
 *
 * Filtering happens in SQL rather than in memory because the list query is
 * paginated: filtering an already-LIMITed page would search only within the
 * newest N rows instead of across everything that matches.
 */
function buildFeedbackConditions(productId: string, filters?: FeedbackFilters) {
  const conditions = [eq(feedback.productId, productId)]

  if (filters?.status) conditions.push(eq(feedback.status, filters.status))
  if (filters?.sentiment) conditions.push(eq(feedback.sentiment, filters.sentiment))
  if (filters?.modality) conditions.push(eq(feedback.modalityPrimary, filters.modality))
  if (filters?.language) conditions.push(eq(feedback.originalLanguage, filters.language))

  if (typeof filters?.ratingMin === 'number') {
    conditions.push(gte(feedback.rating, filters.ratingMin))
  }
  if (typeof filters?.ratingMax === 'number') {
    conditions.push(lte(feedback.rating, filters.ratingMax))
  }

  // Date objects are correct here: this is Drizzle against a `timestamp`
  // column, not a pgClient template literal (which would need .toISOString()
  // — see CLAUDE.md §5). The caller is responsible for widening `dateTo` to
  // end-of-day so a single-day range isn't empty.
  if (filters?.dateFrom) conditions.push(gte(feedback.createdAt, filters.dateFrom))
  if (filters?.dateTo) conditions.push(lte(feedback.createdAt, filters.dateTo))

  return conditions
}

/**
 * Get feedback for a specific product with pagination + optional filters
 */
export async function getFeedbackByProduct(
  productId: string,
  options?: FeedbackFilters & {
    limit?: number
    offset?: number
  }
): Promise<FeedbackItem[]> {
  const limit = options?.limit ?? 50
  const offset = options?.offset ?? 0

  const conditions = buildFeedbackConditions(productId, options)

  const rows = await db
    .select({
      id: feedback.id,
      productId: feedback.productId,
      userName: feedback.userName,
      userEmail: feedback.userEmail,
      feedbackText: feedback.feedbackText,
      rating: feedback.rating,
      sentiment: feedback.sentiment,
      category: feedback.category,
      status: feedback.status,
      modalityPrimary: feedback.modalityPrimary,
      processingStatus: feedback.processingStatus,
      originalLanguage: feedback.originalLanguage,
      normalizedLanguage: feedback.normalizedLanguage,
      normalizedText: feedback.normalizedText,
      transcriptText: feedback.transcriptText,
      createdAt: feedback.createdAt,
    })
    .from(feedback)
    .where(and(...conditions))
    .orderBy(desc(feedback.createdAt))
    .limit(limit)
    .offset(offset)

  return rows
}

/**
 * Get all feedback for a brand (across all their products)
 */
export async function getFeedbackByProductIds(
  productIds: string[],
  options?: {
    limit?: number
    offset?: number
  }
): Promise<FeedbackItem[]> {
  if (productIds.length === 0) return []

  const limit = options?.limit ?? 50
  const offset = options?.offset ?? 0

  const rows = await db
    .select({
      id: feedback.id,
      productId: feedback.productId,
      userName: feedback.userName,
      userEmail: feedback.userEmail,
      feedbackText: feedback.feedbackText,
      rating: feedback.rating,
      sentiment: feedback.sentiment,
      category: feedback.category,
      status: feedback.status,
      modalityPrimary: feedback.modalityPrimary,
      processingStatus: feedback.processingStatus,
      originalLanguage: feedback.originalLanguage,
      normalizedLanguage: feedback.normalizedLanguage,
      normalizedText: feedback.normalizedText,
      transcriptText: feedback.transcriptText,
      createdAt: feedback.createdAt,
    })
    .from(feedback)
    .where(sql`${feedback.productId} = ANY(${productIds})`)
    .orderBy(desc(feedback.createdAt))
    .limit(limit)
    .offset(offset)

  return rows
}

/**
 * Count feedback by product, honouring the same filters as
 * `getFeedbackByProduct` (both build their predicate from
 * `buildFeedbackConditions`, so the count always matches the rows).
 */
export async function countFeedbackByProduct(
  productId: string,
  filters?: FeedbackFilters
): Promise<number> {
  const [result] = await db
    .select({ count: count() })
    .from(feedback)
    .where(and(...buildFeedbackConditions(productId, filters)))

  return result?.count ?? 0
}

/**
 * Distinct detected languages present in a product's feedback, so the language
 * filter only offers values that can actually return rows. Ordered, NULLs
 * dropped. Returns [] on error — the filter degrades to "All languages".
 */
export async function getFeedbackLanguagesForProduct(
  productId: string
): Promise<string[]> {
  try {
    const rows = await db
      .selectDistinct({ language: feedback.originalLanguage })
      .from(feedback)
      .where(
        and(
          eq(feedback.productId, productId),
          isNotNull(feedback.originalLanguage)
        )
      )

    return rows
      .map((r) => r.language)
      .filter((l): l is string => Boolean(l))
      .sort()
  } catch (err) {
    console.error('[getFeedbackLanguagesForProduct] Error (non-fatal):', err)
    return []
  }
}

/**
 * Get feedback stats summary for a product
 */
export async function getFeedbackStats(productId: string) {
  const rows = await db
    .select({
      totalCount: count(),
      avgRating: sql<number>`COALESCE(AVG(${feedback.rating}), 0)`,
      positiveCount: sql<number>`COUNT(*) FILTER (WHERE ${feedback.sentiment} = 'positive')`,
      negativeCount: sql<number>`COUNT(*) FILTER (WHERE ${feedback.sentiment} = 'negative')`,
      neutralCount: sql<number>`COUNT(*) FILTER (WHERE ${feedback.sentiment} = 'neutral')`,
      textCount: sql<number>`COUNT(*) FILTER (WHERE ${feedback.modalityPrimary} = 'text')`,
      audioCount: sql<number>`COUNT(*) FILTER (WHERE ${feedback.modalityPrimary} = 'audio')`,
      videoCount: sql<number>`COUNT(*) FILTER (WHERE ${feedback.modalityPrimary} = 'video')`,
      mixedCount: sql<number>`COUNT(*) FILTER (WHERE ${feedback.modalityPrimary} = 'mixed')`,
    })
    .from(feedback)
    .where(eq(feedback.productId, productId))

  return rows[0] || {
    totalCount: 0,
    avgRating: 0,
    positiveCount: 0,
    negativeCount: 0,
    neutralCount: 0,
    textCount: 0,
    audioCount: 0,
    videoCount: 0,
    mixedCount: 0,
  }
}

/**
 * Fetch a single feedback row's identity + ownership-relevant fields.
 *
 * Exists so routes can resolve feedback -> product before authorizing a
 * mutation; returns only what an ownership check needs, not the consumer's
 * text or contact details.
 */
export async function getFeedbackById(
  feedbackId: string
): Promise<{ id: string; productId: string; status: string } | null> {
  try {
    const [row] = await db
      .select({
        id: feedback.id,
        productId: feedback.productId,
        status: feedback.status,
      })
      .from(feedback)
      .where(eq(feedback.id, feedbackId as any))
      .limit(1)

    return row ?? null
  } catch (err) {
    console.error('[getFeedbackById] Error (denying access):', err)
    return null
  }
}

/**
 * Update feedback status (for brand review workflow)
 */
export async function updateFeedbackStatus(
  feedbackId: string,
  status: 'new' | 'reviewed' | 'addressed'
) {
  const [updated] = await db
    .update(feedback)
    .set({ status })
    .where(eq(feedback.id, feedbackId))
    .returning()

  return updated
}

export type MediaItem = {
  id: string
  ownerId: string
  mediaType: string
  storageKey: string
  mimeType: string | null
  durationMs: number | null
  status: string
  moderationStatus: string | null
}

/**
 * Resolve the brand that owns a media attachment, via its polymorphic parent:
 *   feedback_media → (feedback | survey_responses) → products.owner_id
 *
 * `feedback_media.owner_id` is polymorphic (`owner_type` is 'feedback' or
 * 'survey_response') and deliberately carries NO foreign key — migration 032
 * dropped the FK that migration 031 wrongly added, which had broken every
 * audio/video/image upload. So the join is resolved in code, per owner_type.
 *
 * Returns null when the parent row, its product, or the product's owner_id
 * cannot be resolved. Callers MUST treat null as "deny", not "allow".
 */
export async function getBrandIdForMediaOwner(
  ownerType: string,
  ownerId: string
): Promise<string | null> {
  try {
    let productId: string | null = null

    if (ownerType === 'feedback') {
      const [row] = await db
        .select({ productId: feedback.productId })
        .from(feedback)
        .where(eq(feedback.id, ownerId as any))
        .limit(1)
      productId = row?.productId ?? null
    } else if (ownerType === 'survey_response') {
      const [row] = await db
        .select({ productId: surveyResponses.productId })
        .from(surveyResponses)
        .where(eq(surveyResponses.id, ownerId))
        .limit(1)
      productId = row?.productId ?? null
    } else {
      // Unknown owner_type — fail closed rather than guessing.
      return null
    }

    if (!productId) return null

    const [product] = await db
      .select({ ownerId: products.ownerId })
      .from(products)
      .where(eq(products.id, productId))
      .limit(1)

    return product?.ownerId ?? null
  } catch (err) {
    console.error('[getBrandIdForMediaOwner] Error (denying access):', err)
    return null
  }
}

/**
 * Get all media attachments for a list of feedback IDs.
 * Returns a Map<feedbackId, MediaItem[]> for O(1) lookup per feedback.
 */
export async function getMediaForFeedbackIds(
  feedbackIds: string[]
): Promise<Map<string, MediaItem[]>> {
  const result = new Map<string, MediaItem[]>()
  if (feedbackIds.length === 0) return result

  // Strategy: try with full column set first, fall back to minimal columns
  // if optional columns (added in later migrations) don't exist yet in the DB.
  const runQuery = async (includeModeration: boolean) => {
    const selectFields: Record<string, any> = {
      id: feedbackMedia.id,
      ownerId: feedbackMedia.ownerId,
      mediaType: feedbackMedia.mediaType,
      storageKey: feedbackMedia.storageKey,
      mimeType: feedbackMedia.mimeType,
      durationMs: feedbackMedia.durationMs,
      status: feedbackMedia.status,
    }
    if (includeModeration) {
      selectFields.moderationStatus = feedbackMedia.moderationStatus
    }
    return db
      .select(selectFields)
      .from(feedbackMedia)
      .where(
        and(
          eq(feedbackMedia.ownerType, 'feedback'),
          inArray(feedbackMedia.ownerId, feedbackIds)
        )
      )
  }

  try {
    let rows: any[]
    try {
      rows = await runQuery(true)
    } catch {
      // moderation_status column likely not yet applied — retry without it
      console.warn('[getMediaForFeedbackIds] Falling back: moderation_status column missing, retrying without it')
      rows = await runQuery(false)
    }

    for (const row of rows) {
      // Skip hidden/deleted media (only if moderation column exists)
      if (row.moderationStatus === 'hidden' || row.status === 'deleted') continue
      const existing = result.get(row.ownerId) || []
      existing.push({ ...row, moderationStatus: row.moderationStatus ?? null })
      result.set(row.ownerId, existing)
    }
  } catch (err) {
    // feedback_media table might not exist yet — return empty
    console.error('[getMediaForFeedbackIds] Error (non-fatal):', err)
  }

  return result
}
