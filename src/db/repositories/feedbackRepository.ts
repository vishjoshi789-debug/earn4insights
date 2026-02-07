import { db } from '@/db'
import { feedback } from '@/db/schema'
import { eq, desc, and, sql, count } from 'drizzle-orm'

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
 * Get feedback for a specific product with pagination
 */
export async function getFeedbackByProduct(
  productId: string,
  options?: {
    limit?: number
    offset?: number
    status?: string
    sentiment?: string
  }
): Promise<FeedbackItem[]> {
  const limit = options?.limit ?? 50
  const offset = options?.offset ?? 0

  const conditions = [eq(feedback.productId, productId)]

  if (options?.status) {
    conditions.push(eq(feedback.status, options.status))
  }

  if (options?.sentiment) {
    conditions.push(eq(feedback.sentiment, options.sentiment))
  }

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
 * Count feedback by product
 */
export async function countFeedbackByProduct(productId: string): Promise<number> {
  const [result] = await db
    .select({ count: count() })
    .from(feedback)
    .where(eq(feedback.productId, productId))

  return result?.count ?? 0
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
