/**
 * Social Analytics Service
 *
 * Provides analytics aggregations, sentiment trends, platform breakdowns,
 * and product-level social scores that other parts of the app consume:
 *   - Brand Analytics dashboard
 *   - Unified Analytics
 *   - Rankings engine (social signal boost)
 *   - Feature Intelligence
 *   - Consumer Intelligence
 */

import 'server-only'
import { db } from '@/db'
import { socialPosts, products } from '@/db/schema'
import { eq, and, inArray, gte, lte, desc, sql } from 'drizzle-orm'
import {
  getSocialAggregateMetrics,
  getSocialTrends,
  getSocialSentimentForProducts,
  type SocialFilters,
  type SocialAggregateMetrics,
  type SocialTrendPoint,
} from '@/db/repositories/socialRepository'

// ============================================================================
// TYPES
// ============================================================================

export interface SocialProductScore {
  productId: string
  socialSentimentScore: number   // -1 to 1 (average across all posts)
  socialVolumeScore: number      // 0–1 normalised by volume
  socialEngagementScore: number  // 0–1 average engagement
  socialReviewRating: number     // average star rating from review platforms (0 if none)
  totalMentions: number
  platformBreakdown: Record<string, number>
  sentimentBreakdown: { positive: number; neutral: number; negative: number }
  trendDirection: 'up' | 'down' | 'stable'
  weekOverWeekChange: number
}

export interface SocialOverview {
  metrics: SocialAggregateMetrics
  trends: SocialTrendPoint[]
  topKeywords: Array<{ keyword: string; count: number }>
  recentHighlights: Array<{
    id: string
    platform: string
    author: string | null
    content: string
    sentiment: string | null
    likes: number
    postedAt: Date | null
  }>
}

// ============================================================================
// PRODUCT-LEVEL SOCIAL SCORE
// Consumed by rankings engine, brand analytics, feature insights
// ============================================================================

export async function getSocialProductScore(
  productId: string,
  daysBack = 30
): Promise<SocialProductScore> {
  const dateFrom = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000)
  const prevDateFrom = new Date(Date.now() - daysBack * 2 * 24 * 60 * 60 * 1000)

  const filters: SocialFilters = { productId, dateFrom }
  const prevFilters: SocialFilters = { productId, dateFrom: prevDateFrom, dateTo: dateFrom }

  const [metrics, prevMetrics] = await Promise.all([
    getSocialAggregateMetrics(filters),
    getSocialAggregateMetrics(prevFilters),
  ])

  // Volume score: log-normalised
  const volumeScore = metrics.totalPosts > 0
    ? Math.min(Math.log10(metrics.totalPosts + 1) / 3, 1)
    : 0

  // Engagement score: average of all posts' engagement
  const engagementScore = metrics.totalPosts > 0
    ? Math.min(
        (metrics.totalLikes + metrics.totalShares * 2 + metrics.totalComments * 3) /
          (metrics.totalPosts * 100),
        1
      )
    : 0

  // Review rating from review platforms
  const reviewRating = metrics.avgRating ?? 0

  // Week-over-week change
  const prevTotal = prevMetrics.totalPosts || 1
  const wow = ((metrics.totalPosts - prevTotal) / prevTotal) * 100
  const trendDirection: 'up' | 'down' | 'stable' =
    wow > 10 ? 'up' : wow < -10 ? 'down' : 'stable'

  return {
    productId,
    socialSentimentScore: metrics.avgSentimentScore,
    socialVolumeScore: volumeScore,
    socialEngagementScore: engagementScore,
    socialReviewRating: reviewRating,
    totalMentions: metrics.totalPosts,
    platformBreakdown: metrics.byPlatform,
    sentimentBreakdown: {
      positive: metrics.bySentiment.positive,
      neutral: metrics.bySentiment.neutral,
      negative: metrics.bySentiment.negative,
    },
    trendDirection,
    weekOverWeekChange: wow,
  }
}

/**
 * Get social scores for multiple products at once (used by rankings).
 */
export async function getSocialProductScores(
  productIds: string[],
  daysBack = 30
): Promise<Record<string, SocialProductScore>> {
  if (productIds.length === 0) return {}

  const result: Record<string, SocialProductScore> = {}
  const sentimentMap = await getSocialSentimentForProducts(productIds)

  // Batch per-product metrics query
  const dateFrom = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000)

  const rows = await db
    .select({
      productId: socialPosts.productId,
      total: sql<number>`count(*)::int`,
      avgSentiment: sql<number>`coalesce(avg(sentiment_score), 0)::float`,
      avgRating: sql<number | null>`avg(rating)::float`,
      totalLikes: sql<number>`coalesce(sum(likes), 0)::int`,
      totalShares: sql<number>`coalesce(sum(shares), 0)::int`,
      totalComments: sql<number>`coalesce(sum(comments), 0)::int`,
      sentPositive: sql<number>`count(*) FILTER (WHERE sentiment = 'positive')::int`,
      sentNeutral: sql<number>`count(*) FILTER (WHERE sentiment = 'neutral')::int`,
      sentNegative: sql<number>`count(*) FILTER (WHERE sentiment = 'negative')::int`,
    })
    .from(socialPosts)
    .where(
      and(
        inArray(socialPosts.productId, productIds),
        gte(socialPosts.postedAt, dateFrom)
      )
    )
    .groupBy(socialPosts.productId)

  for (const row of rows) {
    const volumeScore = Math.min(Math.log10(row.total + 1) / 3, 1)
    const engagementScore = row.total > 0
      ? Math.min((row.totalLikes + row.totalShares * 2 + row.totalComments * 3) / (row.total * 100), 1)
      : 0

    result[row.productId] = {
      productId: row.productId,
      socialSentimentScore: row.avgSentiment,
      socialVolumeScore: volumeScore,
      socialEngagementScore: engagementScore,
      socialReviewRating: row.avgRating ?? 0,
      totalMentions: row.total,
      platformBreakdown: {},
      sentimentBreakdown: {
        positive: row.sentPositive,
        neutral: row.sentNeutral,
        negative: row.sentNegative,
      },
      trendDirection: 'stable',
      weekOverWeekChange: 0,
    }
  }

  // Fill in products with no social data
  for (const pid of productIds) {
    if (!result[pid]) {
      result[pid] = {
        productId: pid,
        socialSentimentScore: 0,
        socialVolumeScore: 0,
        socialEngagementScore: 0,
        socialReviewRating: 0,
        totalMentions: 0,
        platformBreakdown: {},
        sentimentBreakdown: { positive: 0, neutral: 0, negative: 0 },
        trendDirection: 'stable',
        weekOverWeekChange: 0,
      }
    }
  }

  return result
}

// ============================================================================
// SOCIAL OVERVIEW (for the Social page)
// ============================================================================

export async function getSocialOverview(
  productIds: string[],
  daysBack = 30
): Promise<SocialOverview> {
  const dateFrom = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000)
  const filters: SocialFilters = { productIds, dateFrom }

  const [metrics, trends] = await Promise.all([
    getSocialAggregateMetrics(filters),
    getSocialTrends(filters, 'day'),
  ])

  // Top keywords from recent posts
  const keywordRows = await db
    .select({
      keywords: socialPosts.keywords,
    })
    .from(socialPosts)
    .where(
      and(
        inArray(socialPosts.productId, productIds),
        gte(socialPosts.postedAt, dateFrom)
      )
    )
    .limit(200)

  const keywordCounts: Record<string, number> = {}
  for (const row of keywordRows) {
    const kws = (row.keywords as string[] | null) ?? []
    for (const kw of kws) {
      keywordCounts[kw] = (keywordCounts[kw] || 0) + 1
    }
  }
  const topKeywords = Object.entries(keywordCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([keyword, count]) => ({ keyword, count }))

  // Recent highlights (high engagement or strong sentiment)
  const highlights = await db
    .select({
      id: socialPosts.id,
      platform: socialPosts.platform,
      author: socialPosts.author,
      content: socialPosts.content,
      sentiment: socialPosts.sentiment,
      likes: socialPosts.likes,
      postedAt: socialPosts.postedAt,
    })
    .from(socialPosts)
    .where(
      and(
        inArray(socialPosts.productId, productIds),
        gte(socialPosts.postedAt, dateFrom)
      )
    )
    .orderBy(desc(socialPosts.likes))
    .limit(5)

  return { metrics, trends, topKeywords, recentHighlights: highlights }
}

// ============================================================================
// SOCIAL SENTIMENT CONTRIBUTION TO NPS / BRAND ANALYTICS
// ============================================================================

/**
 * Calculate a "social NPS proxy" from review ratings.
 * Maps star ratings to NPS categories:
 *   5 stars → promoter (+1)
 *   4 stars → passive (0)
 *   1-3 stars → detractor (-1)
 */
export async function getSocialNPSProxy(
  productIds: string[],
  daysBack = 30
): Promise<{ nps: number; promoters: number; passives: number; detractors: number; total: number }> {
  if (productIds.length === 0) return { nps: 0, promoters: 0, passives: 0, detractors: 0, total: 0 }

  const dateFrom = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000)

  const [result] = await db
    .select({
      promoters: sql<number>`count(*) FILTER (WHERE rating >= 4.5)::int`,
      passives: sql<number>`count(*) FILTER (WHERE rating >= 3.5 AND rating < 4.5)::int`,
      detractors: sql<number>`count(*) FILTER (WHERE rating < 3.5)::int`,
      total: sql<number>`count(*) FILTER (WHERE rating IS NOT NULL)::int`,
    })
    .from(socialPosts)
    .where(
      and(
        inArray(socialPosts.productId, productIds),
        gte(socialPosts.postedAt, dateFrom)
      )
    )

  const total = result?.total || 0
  if (total === 0) return { nps: 0, promoters: 0, passives: 0, detractors: 0, total: 0 }

  const nps = (((result.promoters || 0) - (result.detractors || 0)) / total) * 100

  return {
    nps: Math.round(nps),
    promoters: result.promoters || 0,
    passives: result.passives || 0,
    detractors: result.detractors || 0,
    total,
  }
}
