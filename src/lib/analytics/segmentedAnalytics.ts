import 'server-only'

import { db } from '@/db'
import {
  feedback,
  surveyResponses,
  userProfiles,
  products,
  analyticsEvents,
  userEvents,
} from '@/db/schema'
import { eq, and, gte, desc, sql, inArray, lt } from 'drizzle-orm'
import { classifyEngagementTier } from '@/lib/personalization/userSignalAggregator'

// ── Types ─────────────────────────────────────────────────────────

export type SegmentFilter = {
  ageRanges?: string[]
  genders?: string[]
  countries?: string[]
  engagementTiers?: ('power' | 'active' | 'casual' | 'dormant' | 'new')[]
  professions?: string[]
  deviceTypes?: string[]
}

export type SegmentBreakdownItem = {
  segmentKey: string
  segmentValue: string
  userCount: number
  feedbackCount: number
  avgRating: number | null
  avgSentiment: number // -1 to 1
  sentimentDistribution: { positive: number; negative: number; neutral: number }
  npsScore: number | null
  topThemes: string[]
  suppressed: boolean // true if group < K_ANONYMITY_THRESHOLD
}

export type SegmentedAnalyticsResult = {
  productId: string
  productName: string
  segmentDimension: string // 'age' | 'gender' | 'country' | 'engagement' | 'device'
  segments: SegmentBreakdownItem[]
  totalRespondents: number
  totalFeedback: number
  kAnonymityThreshold: number
  computedAt: string
}

export type CrossSegmentInsight = {
  insight: string
  severity: 'high' | 'medium' | 'low'
  segment: string
  metric: string
  value: number
}

export type ConsumerIntelligenceResult = {
  productId: string
  productName: string
  segmentBreakdowns: Record<string, SegmentBreakdownItem[]> // dimension -> items
  crossSegmentInsights: CrossSegmentInsight[]
  overallStats: {
    totalRespondents: number
    totalFeedback: number
    avgRating: number | null
    avgSentiment: number
    engagementDistribution: Record<string, number>
  }
  kAnonymityThreshold: number
  computedAt: string
}

// ── Constants ─────────────────────────────────────────────────────

const K_ANONYMITY_THRESHOLD = 5 // Minimum group size to prevent deanonymization

const AGE_RANGE_ORDER = ['13-17', '18-24', '25-34', '35-44', '45-54', '55-64', '65+']

// ── Main Functions ────────────────────────────────────────────────

/**
 * Get segmented analytics for a single product across one dimension.
 * Enforces k-anonymity: groups with fewer than K_ANONYMITY_THRESHOLD users are suppressed.
 */
export async function getSegmentedAnalytics(
  productId: string,
  dimension: 'age' | 'gender' | 'country' | 'engagement' | 'device'
): Promise<SegmentedAnalyticsResult> {
  const now = new Date()

  // 1. Get product info
  const productRows = await db
    .select({ id: products.id, name: products.name })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1)

  const productName = productRows[0]?.name || 'Unknown Product'

  // 2. Get all feedback for this product joined with user profiles
  const feedbackWithProfiles = await getFeedbackWithProfiles(productId)

  // 3. Group by the requested dimension
  const segments = groupByDimension(feedbackWithProfiles, dimension)

  // 4. Apply k-anonymity suppression
  const processedSegments = segments.map(segment => ({
    ...segment,
    suppressed: segment.userCount < K_ANONYMITY_THRESHOLD,
    // If suppressed, zero out specifics
    ...(segment.userCount < K_ANONYMITY_THRESHOLD ? {
      avgRating: null,
      avgSentiment: 0,
      sentimentDistribution: { positive: 0, negative: 0, neutral: 0 },
      npsScore: null,
      topThemes: [],
      feedbackCount: 0,
    } : {}),
  }))

  return {
    productId,
    productName,
    segmentDimension: dimension,
    segments: processedSegments,
    totalRespondents: new Set(feedbackWithProfiles.map(f => f.userId)).size,
    totalFeedback: feedbackWithProfiles.length,
    kAnonymityThreshold: K_ANONYMITY_THRESHOLD,
    computedAt: now.toISOString(),
  }
}

/**
 * Get full consumer intelligence for a product — all dimensions + insights.
 * This is the comprehensive brand intelligence view.
 */
export async function getConsumerIntelligence(
  productId: string
): Promise<ConsumerIntelligenceResult> {
  const now = new Date()

  // 1. Get product info
  const productRows = await db
    .select({ id: products.id, name: products.name })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1)

  const productName = productRows[0]?.name || 'Unknown Product'

  // 2. Get all feedback with profiles (single query, reused across dimensions)
  const feedbackWithProfiles = await getFeedbackWithProfiles(productId)

  // 3. Build segment breakdowns for each dimension
  const dimensions = ['age', 'gender', 'country', 'engagement', 'device'] as const
  const segmentBreakdowns: Record<string, SegmentBreakdownItem[]> = {}

  for (const dim of dimensions) {
    const segments = groupByDimension(feedbackWithProfiles, dim)
    segmentBreakdowns[dim] = segments.map(segment => ({
      ...segment,
      suppressed: segment.userCount < K_ANONYMITY_THRESHOLD,
      ...(segment.userCount < K_ANONYMITY_THRESHOLD ? {
        avgRating: null,
        avgSentiment: 0,
        sentimentDistribution: { positive: 0, negative: 0, neutral: 0 },
        npsScore: null,
        topThemes: [],
        feedbackCount: 0,
      } : {}),
    }))
  }

  // 4. Generate cross-segment insights
  const crossSegmentInsights = generateCrossSegmentInsights(segmentBreakdowns)

  // 5. Overall stats
  const uniqueUsers = new Set(feedbackWithProfiles.map(f => f.userId))
  const ratings = feedbackWithProfiles.filter(f => f.rating != null).map(f => f.rating!)
  const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null
  const avgSentiment = computeAvgSentiment(feedbackWithProfiles.map(f => f.sentiment))

  // Engagement distribution
  const engagementDist: Record<string, number> = {}
  for (const fb of feedbackWithProfiles) {
    const tier = fb.engagementTier || 'unknown'
    engagementDist[tier] = (engagementDist[tier] || 0) + 1
  }

  return {
    productId,
    productName,
    segmentBreakdowns,
    crossSegmentInsights,
    overallStats: {
      totalRespondents: uniqueUsers.size,
      totalFeedback: feedbackWithProfiles.length,
      avgRating,
      avgSentiment,
      engagementDistribution: engagementDist,
    },
    kAnonymityThreshold: K_ANONYMITY_THRESHOLD,
    computedAt: now.toISOString(),
  }
}

// ── Data Fetching ─────────────────────────────────────────────────

type FeedbackWithProfile = {
  feedbackId: string
  productId: string
  userId: string
  rating: number | null
  sentiment: string | null
  feedbackText: string
  createdAt: Date
  // Profile dimensions
  ageRange: string | null
  gender: string | null
  country: string | null
  profession: string | null
  engagementTier: string | null
  engagementScore: number
  deviceType: string | null
}

/**
 * Fetch feedback entries joined with user profile demographics.
 * This is the core data source for all segmented analytics.
 */
async function getFeedbackWithProfiles(productId: string): Promise<FeedbackWithProfile[]> {
  // Get feedback for this product
  const feedbackRows = await db
    .select({
      id: feedback.id,
      productId: feedback.productId,
      userEmail: feedback.userEmail,
      rating: feedback.rating,
      sentiment: feedback.sentiment,
      feedbackText: feedback.feedbackText,
      createdAt: feedback.createdAt,
    })
    .from(feedback)
    .where(eq(feedback.productId, productId))
    .orderBy(desc(feedback.createdAt))
    .limit(1000)

  if (feedbackRows.length === 0) return []

  // Get unique user emails
  const emails = [...new Set(feedbackRows.map(f => f.userEmail).filter(Boolean))] as string[]
  if (emails.length === 0) return []

  // Batch fetch user profiles by email
  const profileMap = new Map<string, any>()
  for (let i = 0; i < emails.length; i += 50) {
    const batch = emails.slice(i, i + 50)
    const profiles = await db
      .select({
        id: userProfiles.id,
        email: userProfiles.email,
        demographics: userProfiles.demographics,
        behavioral: userProfiles.behavioral,
        onboardingComplete: userProfiles.onboardingComplete,
      })
      .from(userProfiles)
      .where(inArray(userProfiles.email, batch))

    for (const p of profiles) {
      profileMap.set(p.email, p)
    }
  }

  // Also fetch device type from analytics events for users who have them
  const userIds = [...profileMap.values()].map((p: any) => p.id).filter(Boolean)
  const deviceMap = new Map<string, string>()
  if (userIds.length > 0) {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    // Get most common device type per user
    const deviceRows = await db
      .select({
        userId: analyticsEvents.userId,
        deviceType: analyticsEvents.deviceType,
        count: sql<number>`count(*)::int`,
      })
      .from(analyticsEvents)
      .where(
        and(
          inArray(analyticsEvents.userId, userIds),
          gte(analyticsEvents.createdAt, thirtyDaysAgo)
        )
      )
      .groupBy(analyticsEvents.userId, analyticsEvents.deviceType)
      .orderBy(desc(sql`count(*)`))

    // Pick top device per user
    for (const row of deviceRows) {
      if (row.userId && !deviceMap.has(row.userId)) {
        deviceMap.set(row.userId, row.deviceType || 'unknown')
      }
    }
  }

  // Join feedback with profile data
  return feedbackRows.map(fb => {
    const profile = fb.userEmail ? profileMap.get(fb.userEmail) : null
    const demographics = (profile?.demographics as any) || {}
    const behavioral = (profile?.behavioral as any) || {}

    const engagementScore = behavioral.engagementScore || 0
    const totalEvents = behavioral.totalEvents || 0
    const lastActiveAt = behavioral.lastActiveAt
    const daysSinceActive = lastActiveAt
      ? Math.floor((Date.now() - new Date(lastActiveAt).getTime()) / (1000 * 60 * 60 * 24))
      : 999

    const engagementTier = profile
      ? classifyEngagementTier(engagementScore, totalEvents, daysSinceActive, profile.onboardingComplete)
      : null

    return {
      feedbackId: fb.id,
      productId: fb.productId,
      userId: profile?.id || fb.userEmail || 'anonymous',
      rating: fb.rating,
      sentiment: fb.sentiment,
      feedbackText: fb.feedbackText,
      createdAt: fb.createdAt,
      ageRange: demographics.ageRange || demographics.age || null,
      gender: demographics.gender || null,
      country: demographics.country || demographics.location || null,
      profession: demographics.profession || null,
      engagementTier,
      engagementScore,
      deviceType: profile?.id ? (deviceMap.get(profile.id) || null) : null,
    }
  })
}

// ── Grouping Logic ────────────────────────────────────────────────

function groupByDimension(
  data: FeedbackWithProfile[],
  dimension: 'age' | 'gender' | 'country' | 'engagement' | 'device'
): SegmentBreakdownItem[] {
  const groups = new Map<string, FeedbackWithProfile[]>()

  for (const item of data) {
    let key: string | null = null

    switch (dimension) {
      case 'age':
        key = item.ageRange || 'Unknown'
        break
      case 'gender':
        key = item.gender ? capitalizeFirst(item.gender) : 'Unknown'
        break
      case 'country':
        key = item.country || 'Unknown'
        break
      case 'engagement':
        key = item.engagementTier ? capitalizeFirst(item.engagementTier) : 'Unknown'
        break
      case 'device':
        key = item.deviceType ? capitalizeFirst(item.deviceType) : 'Unknown'
        break
    }

    if (!key) key = 'Unknown'
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(item)
  }

  // Convert to SegmentBreakdownItem array
  const result: SegmentBreakdownItem[] = []

  for (const [segmentValue, items] of groups) {
    const uniqueUsers = new Set(items.map(i => i.userId))
    const ratings = items.filter(i => i.rating != null).map(i => i.rating!)
    const avgRating = ratings.length > 0
      ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
      : null

    const positive = items.filter(i => i.sentiment === 'positive').length
    const negative = items.filter(i => i.sentiment === 'negative').length
    const neutral = items.filter(i => i.sentiment !== 'positive' && i.sentiment !== 'negative').length

    const avgSentiment = items.length > 0
      ? Math.round(((positive - negative) / items.length) * 100) / 100
      : 0

    // Extract top themes from feedback text (simple frequency analysis)
    const topThemes = extractTopThemes(items.map(i => i.feedbackText), 3)

    result.push({
      segmentKey: dimension,
      segmentValue,
      userCount: uniqueUsers.size,
      feedbackCount: items.length,
      avgRating,
      avgSentiment,
      sentimentDistribution: { positive, negative, neutral },
      npsScore: null, // Would need survey join — future enhancement
      topThemes,
      suppressed: false, // Set by caller after k-anonymity check
    })
  }

  // Sort intelligently based on dimension
  if (dimension === 'age') {
    result.sort((a, b) => {
      const aIdx = AGE_RANGE_ORDER.indexOf(a.segmentValue)
      const bIdx = AGE_RANGE_ORDER.indexOf(b.segmentValue)
      if (aIdx === -1 && bIdx === -1) return 0
      if (aIdx === -1) return 1
      if (bIdx === -1) return -1
      return aIdx - bIdx
    })
  } else {
    result.sort((a, b) => b.feedbackCount - a.feedbackCount)
  }

  return result
}

// ── Cross-Segment Insight Generation ──────────────────────────────

function generateCrossSegmentInsights(
  breakdowns: Record<string, SegmentBreakdownItem[]>
): CrossSegmentInsight[] {
  const insights: CrossSegmentInsight[] = []

  for (const [dimension, segments] of Object.entries(breakdowns)) {
    const validSegments = segments.filter(s => !s.suppressed && s.feedbackCount >= K_ANONYMITY_THRESHOLD)

    if (validSegments.length < 2) continue

    // Find the most negative segment
    const mostNegative = validSegments.reduce((min, s) =>
      s.avgSentiment < min.avgSentiment ? s : min
    )
    const mostPositive = validSegments.reduce((max, s) =>
      s.avgSentiment > max.avgSentiment ? s : max
    )

    // Significant sentiment gap between segments?
    const sentimentGap = mostPositive.avgSentiment - mostNegative.avgSentiment
    if (sentimentGap >= 0.3) {
      insights.push({
        insight: `${mostNegative.segmentValue} users have significantly lower sentiment (${(mostNegative.avgSentiment * 100).toFixed(0)}%) compared to ${mostPositive.segmentValue} users (${(mostPositive.avgSentiment * 100).toFixed(0)}%)`,
        severity: sentimentGap >= 0.5 ? 'high' : 'medium',
        segment: `${dimension}:${mostNegative.segmentValue}`,
        metric: 'sentiment_gap',
        value: sentimentGap,
      })
    }

    // Find the highest-engagement segment with low satisfaction
    const highEngageLowSat = validSegments.find(
      s => s.segmentKey === 'engagement' && s.segmentValue === 'Power' && s.avgSentiment < 0
    )
    if (highEngageLowSat) {
      insights.push({
        insight: `Your most engaged users (Power tier) are showing negative sentiment — potential churn risk`,
        severity: 'high',
        segment: 'engagement:Power',
        metric: 'churn_risk',
        value: highEngageLowSat.avgSentiment,
      })
    }

    // Find segment with declining ratings
    if (validSegments.some(s => s.avgRating != null && s.avgRating <= 2.5 && s.feedbackCount >= 10)) {
      const lowRated = validSegments.filter(s => s.avgRating != null && s.avgRating <= 2.5 && s.feedbackCount >= 10)
      for (const seg of lowRated) {
        insights.push({
          insight: `${seg.segmentValue} segment has a low average rating of ${seg.avgRating?.toFixed(1)} across ${seg.feedbackCount} reviews`,
          severity: seg.avgRating! <= 2.0 ? 'high' : 'medium',
          segment: `${dimension}:${seg.segmentValue}`,
          metric: 'low_rating',
          value: seg.avgRating!,
        })
      }
    }
  }

  // Sort by severity
  const severityOrder = { high: 0, medium: 1, low: 2 }
  insights.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])

  return insights.slice(0, 10) // Cap at 10 insights
}

// ── Helpers ───────────────────────────────────────────────────────

function computeAvgSentiment(sentiments: (string | null)[]): number {
  if (sentiments.length === 0) return 0
  let sum = 0
  for (const s of sentiments) {
    if (s === 'positive') sum += 1
    else if (s === 'negative') sum -= 1
  }
  return Math.round((sum / sentiments.length) * 100) / 100
}

function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}

/**
 * Simple theme extraction from feedback texts using frequency analysis.
 * Not a replacement for the full theme extraction service, but useful
 * for quick segment-level insights.
 */
function extractTopThemes(texts: string[], limit: number): string[] {
  const themeKeywords: Record<string, string[]> = {
    'Price': ['price', 'pricing', 'cost', 'expensive', 'cheap', 'affordable', 'value'],
    'UX': ['ui', 'ux', 'design', 'interface', 'navigation', 'intuitive', 'confusing'],
    'Performance': ['slow', 'fast', 'speed', 'performance', 'loading', 'lag', 'crash'],
    'Support': ['support', 'help', 'service', 'response', 'agent', 'ticket'],
    'Quality': ['quality', 'reliable', 'bug', 'broken', 'error', 'works', 'stable'],
    'Features': ['feature', 'missing', 'add', 'need', 'want', 'functionality'],
    'Ease of Use': ['easy', 'simple', 'difficult', 'complicated', 'hard', 'learn'],
    'Battery': ['battery', 'charge', 'charging', 'battery life', 'drain', 'power'],
    'Camera': ['camera', 'photo', 'picture', 'lens', 'zoom', 'selfie'],
    'Delivery': ['delivery', 'shipping', 'arrived', 'late', 'packaging'],
  }

  const counts: Record<string, number> = {}
  const allText = texts.join(' ').toLowerCase()

  for (const [theme, keywords] of Object.entries(themeKeywords)) {
    let count = 0
    for (const keyword of keywords) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi')
      const matches = allText.match(regex)
      count += matches?.length || 0
    }
    if (count > 0) counts[theme] = count
  }

  return Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([theme]) => theme)
}
