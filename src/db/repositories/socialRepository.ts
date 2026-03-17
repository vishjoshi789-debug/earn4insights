import { db } from '@/db'
import { socialPosts, products } from '@/db/schema'
import type { SocialPost, NewSocialPost } from '@/db/schema'
import { eq, and, desc, gte, lte, inArray, sql, or, ilike } from 'drizzle-orm'

// ============================================================================
// TYPES
// ============================================================================

export type SocialPlatform =
  | 'twitter'
  | 'instagram'
  | 'tiktok'
  | 'meta'
  | 'google'
  | 'amazon'
  | 'flipkart'
  | 'reddit'
  | 'youtube'
  | 'linkedin'

export type SocialPostType =
  | 'mention'
  | 'review'
  | 'comment'
  | 'discussion'
  | 'complaint'
  | 'praise'

export type SocialCategory =
  | 'product_feedback'
  | 'brand_mention'
  | 'customer_support'
  | 'feature_request'
  | 'comparison'
  | 'other'

export interface SocialFilters {
  productId?: string
  productIds?: string[]
  platforms?: SocialPlatform[]
  postTypes?: SocialPostType[]
  sentiments?: Array<'positive' | 'neutral' | 'negative'>
  categories?: SocialCategory[]
  dateFrom?: Date
  dateTo?: Date
  search?: string
  limit?: number
  offset?: number
}

export interface SocialAggregateMetrics {
  totalPosts: number
  byPlatform: Record<string, number>
  bySentiment: { positive: number; neutral: number; negative: number; unknown: number }
  byCategory: Record<string, number>
  avgSentimentScore: number
  avgRating: number | null
  totalLikes: number
  totalShares: number
  totalComments: number
  totalViews: number
  topAuthors: Array<{ author: string; count: number; platform: string }>
  kolCount: number
}

// ============================================================================
// CRUD OPERATIONS
// ============================================================================

export async function insertSocialPost(post: NewSocialPost): Promise<SocialPost> {
  const [inserted] = await db.insert(socialPosts).values(post).returning()
  return inserted
}

export async function insertSocialPosts(posts: NewSocialPost[]): Promise<number> {
  if (posts.length === 0) return 0
  // Use ON CONFLICT to skip duplicates based on externalId
  await db.insert(socialPosts).values(posts).onConflictDoNothing()
  return posts.length
}

export async function getSocialPostById(id: string): Promise<SocialPost | null> {
  const [post] = await db.select().from(socialPosts).where(eq(socialPosts.id, id))
  return post ?? null
}

export async function getSocialPostByExternalId(externalId: string): Promise<SocialPost | null> {
  const [post] = await db.select().from(socialPosts).where(eq(socialPosts.externalId, externalId))
  return post ?? null
}

// ============================================================================
// QUERY OPERATIONS
// ============================================================================

function buildWhere(filters: SocialFilters) {
  const conditions: any[] = []

  if (filters.productId) {
    conditions.push(eq(socialPosts.productId, filters.productId))
  }
  if (filters.productIds && filters.productIds.length > 0) {
    conditions.push(inArray(socialPosts.productId, filters.productIds))
  }
  if (filters.platforms && filters.platforms.length > 0) {
    conditions.push(inArray(socialPosts.platform, filters.platforms))
  }
  if (filters.postTypes && filters.postTypes.length > 0) {
    conditions.push(inArray(socialPosts.postType, filters.postTypes))
  }
  if (filters.sentiments && filters.sentiments.length > 0) {
    conditions.push(inArray(socialPosts.sentiment, filters.sentiments))
  }
  if (filters.categories && filters.categories.length > 0) {
    conditions.push(inArray(socialPosts.category, filters.categories))
  }
  if (filters.dateFrom) {
    conditions.push(gte(socialPosts.postedAt, filters.dateFrom))
  }
  if (filters.dateTo) {
    conditions.push(lte(socialPosts.postedAt, filters.dateTo))
  }
  if (filters.search) {
    conditions.push(
      or(
        ilike(socialPosts.content, `%${filters.search}%`),
        ilike(socialPosts.author, `%${filters.search}%`),
        ilike(socialPosts.title, `%${filters.search}%`)
      )
    )
  }

  return conditions.length > 0 ? and(...conditions) : undefined
}

export async function getSocialPosts(filters: SocialFilters): Promise<SocialPost[]> {
  const where = buildWhere(filters)
  return db
    .select()
    .from(socialPosts)
    .where(where)
    .orderBy(desc(socialPosts.postedAt))
    .limit(filters.limit ?? 50)
    .offset(filters.offset ?? 0)
}

export async function getSocialPostCount(filters: SocialFilters): Promise<number> {
  const where = buildWhere(filters)
  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(socialPosts)
    .where(where)
  return result?.count ?? 0
}

// ============================================================================
// AGGREGATE ANALYTICS
// ============================================================================

export async function getSocialAggregateMetrics(
  filters: SocialFilters
): Promise<SocialAggregateMetrics> {
  const where = buildWhere(filters)

  // Main counts in a single query
  const [main] = await db
    .select({
      totalPosts: sql<number>`count(*)::int`,
      avgSentimentScore: sql<number>`coalesce(avg(sentiment_score), 0)::float`,
      avgRating: sql<number | null>`avg(rating)::float`,
      totalLikes: sql<number>`coalesce(sum(likes), 0)::int`,
      totalShares: sql<number>`coalesce(sum(shares), 0)::int`,
      totalComments: sql<number>`coalesce(sum(comments), 0)::int`,
      totalViews: sql<number>`coalesce(sum(views), 0)::int`,
      kolCount: sql<number>`count(*) FILTER (WHERE is_key_opinion_leader = true)::int`,
      sentPositive: sql<number>`count(*) FILTER (WHERE sentiment = 'positive')::int`,
      sentNeutral: sql<number>`count(*) FILTER (WHERE sentiment = 'neutral')::int`,
      sentNegative: sql<number>`count(*) FILTER (WHERE sentiment = 'negative')::int`,
      sentUnknown: sql<number>`count(*) FILTER (WHERE sentiment IS NULL)::int`,
    })
    .from(socialPosts)
    .where(where)

  // Platform breakdown
  const platformRows = await db
    .select({
      platform: socialPosts.platform,
      count: sql<number>`count(*)::int`,
    })
    .from(socialPosts)
    .where(where)
    .groupBy(socialPosts.platform)

  const byPlatform: Record<string, number> = {}
  for (const row of platformRows) {
    byPlatform[row.platform] = row.count
  }

  // Category breakdown
  const categoryRows = await db
    .select({
      category: socialPosts.category,
      count: sql<number>`count(*)::int`,
    })
    .from(socialPosts)
    .where(where)
    .groupBy(socialPosts.category)

  const byCategory: Record<string, number> = {}
  for (const row of categoryRows) {
    byCategory[row.category ?? 'other'] = row.count
  }

  // Top authors
  const topAuthors = await db
    .select({
      author: socialPosts.author,
      platform: socialPosts.platform,
      count: sql<number>`count(*)::int`,
    })
    .from(socialPosts)
    .where(where)
    .groupBy(socialPosts.author, socialPosts.platform)
    .orderBy(sql`count(*) DESC`)
    .limit(10)

  return {
    totalPosts: main?.totalPosts ?? 0,
    byPlatform,
    bySentiment: {
      positive: main?.sentPositive ?? 0,
      neutral: main?.sentNeutral ?? 0,
      negative: main?.sentNegative ?? 0,
      unknown: main?.sentUnknown ?? 0,
    },
    byCategory,
    avgSentimentScore: main?.avgSentimentScore ?? 0,
    avgRating: main?.avgRating ?? null,
    totalLikes: main?.totalLikes ?? 0,
    totalShares: main?.totalShares ?? 0,
    totalComments: main?.totalComments ?? 0,
    totalViews: main?.totalViews ?? 0,
    topAuthors: topAuthors
      .filter((a) => a.author)
      .map((a) => ({ author: a.author!, count: a.count, platform: a.platform })),
    kolCount: main?.kolCount ?? 0,
  }
}

// ============================================================================
// TREND ANALYTICS
// ============================================================================

export interface SocialTrendPoint {
  date: string
  totalPosts: number
  positive: number
  neutral: number
  negative: number
  avgSentiment: number
  totalEngagement: number
}

export async function getSocialTrends(
  filters: SocialFilters,
  interval: 'day' | 'week' = 'day'
): Promise<SocialTrendPoint[]> {
  const where = buildWhere(filters)
  const truncFn = interval === 'week' ? `date_trunc('week', posted_at)` : `date_trunc('day', posted_at)`

  const rows = await db
    .select({
      date: sql<string>`${sql.raw(truncFn)}::date::text`,
      totalPosts: sql<number>`count(*)::int`,
      positive: sql<number>`count(*) FILTER (WHERE sentiment = 'positive')::int`,
      neutral: sql<number>`count(*) FILTER (WHERE sentiment = 'neutral')::int`,
      negative: sql<number>`count(*) FILTER (WHERE sentiment = 'negative')::int`,
      avgSentiment: sql<number>`coalesce(avg(sentiment_score), 0)::float`,
      totalEngagement: sql<number>`coalesce(sum(likes + shares + comments), 0)::int`,
    })
    .from(socialPosts)
    .where(where)
    .groupBy(sql`${sql.raw(truncFn)}`)
    .orderBy(sql`${sql.raw(truncFn)}`)

  return rows as SocialTrendPoint[]
}

// ============================================================================
// PLATFORM-SPECIFIC HELPERS
// ============================================================================

export async function getLatestSocialPosts(
  productIds: string[],
  limit = 5
): Promise<SocialPost[]> {
  if (productIds.length === 0) return []
  return db
    .select()
    .from(socialPosts)
    .where(inArray(socialPosts.productId, productIds))
    .orderBy(desc(socialPosts.postedAt))
    .limit(limit)
}

export async function getSocialSentimentForProducts(
  productIds: string[]
): Promise<Record<string, { avg: number; count: number }>> {
  if (productIds.length === 0) return {}
  const rows = await db
    .select({
      productId: socialPosts.productId,
      avg: sql<number>`coalesce(avg(sentiment_score), 0)::float`,
      count: sql<number>`count(*)::int`,
    })
    .from(socialPosts)
    .where(inArray(socialPosts.productId, productIds))
    .groupBy(socialPosts.productId)

  const result: Record<string, { avg: number; count: number }> = {}
  for (const row of rows) {
    result[row.productId] = { avg: row.avg, count: row.count }
  }
  return result
}
