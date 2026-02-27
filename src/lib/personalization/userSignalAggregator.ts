import 'server-only'

import { db } from '@/db'
import { userProfiles, userEvents, feedback, surveyResponses, products, analyticsEvents } from '@/db/schema'
import { eq, and, gte, desc, sql, inArray } from 'drizzle-orm'
import { checkConsent } from '@/lib/consent-enforcement'
import type { ProductCategory } from '@/lib/categories'

// ── Types ─────────────────────────────────────────────────────────

export type UserSignalVector = {
  userId: string

  // Demographics (from onboarding — explicit, user-provided)
  demographics: {
    ageRange: string | null
    gender: string | null
    country: string | null
    city: string | null
    profession: string | null
    education: string | null
    incomeRange: string | null // Only used if sensitiveData consent granted
  }

  // Interest scores (0-1, blended from explicit + behavioral)
  categoryScores: Record<string, number>

  // Engagement classification
  engagementTier: 'power' | 'active' | 'casual' | 'dormant' | 'new'
  engagementScore: number

  // Behavioral signals
  behavioral: {
    totalFeedbackGiven: number
    avgRating: number | null
    sentimentBias: 'positive' | 'negative' | 'balanced' | 'unknown'
    feedbackFrequency: 'high' | 'medium' | 'low' | 'none' // feedback per week
    topDeviceType: string | null
    topCountry: string | null
    activeDayParts: string[] // 'morning' | 'afternoon' | 'evening' | 'night'
    recentCategories: string[] // last 5 categories interacted with
    daysSinceLastActivity: number
  }

  // Computed at
  computedAt: string
}

// ── Engagement Tier Thresholds ────────────────────────────────────

const ENGAGEMENT_TIERS = {
  power: { minScore: 25, minEvents: 50 },
  active: { minScore: 10, minEvents: 15 },
  casual: { minScore: 3, minEvents: 5 },
  dormant: { minScore: 0, minEvents: 0 },
} as const

// ── Main function ─────────────────────────────────────────────────

/**
 * Build a comprehensive signal vector for a user.
 * Blends explicit profile data with behavioral signals.
 * Respects consent boundaries.
 */
export async function aggregateUserSignals(
  userId: string
): Promise<UserSignalVector> {
  const now = new Date()
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  // ── 1. Get user profile ─────────────────────────────────────
  const profileRows = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.id, userId))
    .limit(1)

  const profile = profileRows[0]
  if (!profile) {
    return buildNewUserVector(userId)
  }

  const demographics = (profile.demographics as any) || {}
  const interests = (profile.interests as any) || {}
  const behavioralData = (profile.behavioral as any) || {}
  const sensitiveData = (profile.sensitiveData as any) || {}

  // Check if we have consent for personalization
  const personalizationConsent = await checkConsent(userId, 'personalization')
  const trackingConsent = await checkConsent(userId, 'tracking')

  // ── 2. Build explicit interest scores ───────────────────────
  const explicitCategories: string[] = interests.productCategories || []
  const categoryScores: Record<string, number> = {}

  // Explicit interests start at 0.6 (strong signal, but not max)
  for (const cat of explicitCategories) {
    categoryScores[cat] = 0.6
  }

  // ── 3. Blend with behavioral signals (if consent) ──────────
  if (trackingConsent.allowed) {
    // Get recent user events
    const events = await db
      .select({
        eventType: userEvents.eventType,
        productId: userEvents.productId,
        createdAt: userEvents.createdAt,
        metadata: userEvents.metadata,
      })
      .from(userEvents)
      .where(
        and(
          eq(userEvents.userId, userId),
          gte(userEvents.createdAt, ninetyDaysAgo)
        )
      )
      .orderBy(desc(userEvents.createdAt))
      .limit(500)

    // Event weights for category interest scoring
    const eventWeights: Record<string, number> = {
      product_view: 0.05,
      survey_start: 0.1,
      survey_complete: 0.25,
      feedback_submit: 0.2,
      recommendation_click: 0.15,
      notification_click: 0.08,
    }

    // Collect productIds from events
    const eventProductIds = events
      .map(e => e.productId)
      .filter((id): id is string => !!id)
    
    // Batch fetch product categories
    const productCategoryMap = new Map<string, string>()
    if (eventProductIds.length > 0) {
      const uniqueIds = [...new Set(eventProductIds)]
      // Fetch in batches of 50
      for (let i = 0; i < uniqueIds.length; i += 50) {
        const batch = uniqueIds.slice(i, i + 50)
        const productRows = await db
          .select({ id: products.id, profile: products.profile })
          .from(products)
          .where(inArray(products.id, batch))
        
        for (const p of productRows) {
          const cat = (p.profile as any)?.category || (p.profile as any)?.productCategory
          if (cat) productCategoryMap.set(p.id, cat)
        }
      }
    }

    // Score categories from behavior with time decay
    for (const event of events) {
      if (!event.productId) continue
      const category = productCategoryMap.get(event.productId)
        || (event.metadata as any)?.category
      if (!category) continue

      const weight = eventWeights[event.eventType] || 0.03
      const daysSinceEvent = (now.getTime() - new Date(event.createdAt).getTime()) / (1000 * 60 * 60 * 24)
      
      // Time decay: full weight 0-14d, 75% 14-30d, 50% 30-60d, 25% 60-90d
      let decayFactor = 1.0
      if (daysSinceEvent > 60) decayFactor = 0.25
      else if (daysSinceEvent > 30) decayFactor = 0.5
      else if (daysSinceEvent > 14) decayFactor = 0.75

      const adjustedWeight = weight * decayFactor
      categoryScores[category] = Math.min(
        (categoryScores[category] || 0) + adjustedWeight,
        1.0
      )
    }
  }

  // Normalize category scores to 0-1
  const maxScore = Math.max(...Object.values(categoryScores), 0.01)
  if (maxScore > 1) {
    for (const key of Object.keys(categoryScores)) {
      categoryScores[key] = Math.round((categoryScores[key] / maxScore) * 100) / 100
    }
  }

  // ── 4. Compute feedback behavioral signals ──────────────────
  const userFeedback = await db
    .select({
      rating: feedback.rating,
      sentiment: feedback.sentiment,
      productId: feedback.productId,
      createdAt: feedback.createdAt,
    })
    .from(feedback)
    .where(eq(feedback.userEmail, profile.email))
    .orderBy(desc(feedback.createdAt))
    .limit(200)

  const totalFeedbackGiven = userFeedback.length
  const avgRating = totalFeedbackGiven > 0
    ? userFeedback.reduce((sum, f) => sum + (f.rating || 0), 0) / userFeedback.filter(f => f.rating).length || null
    : null

  // Sentiment bias
  const posCount = userFeedback.filter(f => f.sentiment === 'positive').length
  const negCount = userFeedback.filter(f => f.sentiment === 'negative').length
  const sentimentBias = totalFeedbackGiven === 0 ? 'unknown' as const
    : posCount > negCount * 1.5 ? 'positive' as const
    : negCount > posCount * 1.5 ? 'negative' as const
    : 'balanced' as const

  // Feedback frequency (per week over last 30 days)
  const recentFeedback = userFeedback.filter(
    f => new Date(f.createdAt).getTime() > thirtyDaysAgo.getTime()
  )
  const feedbackPerWeek = recentFeedback.length / 4.3
  const feedbackFrequency = feedbackPerWeek >= 3 ? 'high' as const
    : feedbackPerWeek >= 1 ? 'medium' as const
    : feedbackPerWeek > 0 ? 'low' as const
    : 'none' as const

  // ── 5. Device + geo signals from analytics events ───────────
  let topDeviceType: string | null = null
  let topCountry: string | null = null
  let activeDayParts: string[] = []

  if (trackingConsent.allowed) {
    const deviceResult = await db
      .select({
        deviceType: analyticsEvents.deviceType,
        count: sql<number>`count(*)::int`,
      })
      .from(analyticsEvents)
      .where(
        and(
          eq(analyticsEvents.userId, userId),
          gte(analyticsEvents.createdAt, thirtyDaysAgo)
        )
      )
      .groupBy(analyticsEvents.deviceType)
      .orderBy(desc(sql`count(*)`))
      .limit(1)

    topDeviceType = deviceResult[0]?.deviceType || null

    const countryResult = await db
      .select({
        country: analyticsEvents.country,
        count: sql<number>`count(*)::int`,
      })
      .from(analyticsEvents)
      .where(
        and(
          eq(analyticsEvents.userId, userId),
          gte(analyticsEvents.createdAt, thirtyDaysAgo)
        )
      )
      .groupBy(analyticsEvents.country)
      .orderBy(desc(sql`count(*)`))
      .limit(1)

    topCountry = countryResult[0]?.country || null

    // Active time-of-day distribution
    const hourResult = await db
      .select({
        hour: sql<number>`EXTRACT(HOUR FROM ${analyticsEvents.createdAt})::int`,
        count: sql<number>`count(*)::int`,
      })
      .from(analyticsEvents)
      .where(
        and(
          eq(analyticsEvents.userId, userId),
          gte(analyticsEvents.createdAt, thirtyDaysAgo)
        )
      )
      .groupBy(sql`EXTRACT(HOUR FROM ${analyticsEvents.createdAt})`)
      .orderBy(desc(sql`count(*)`))
      .limit(6)

    activeDayParts = hourResult.map(h => {
      if (h.hour >= 5 && h.hour < 12) return 'morning'
      if (h.hour >= 12 && h.hour < 17) return 'afternoon'
      if (h.hour >= 17 && h.hour < 21) return 'evening'
      return 'night'
    })
    activeDayParts = [...new Set(activeDayParts)]
  }

  // ── 6. Recent categories from feedback ──────────────────────
  const recentCategories: string[] = []
  const recentFbProductIds = userFeedback.slice(0, 10).map(f => f.productId).filter(Boolean)
  if (recentFbProductIds.length > 0) {
    const uniqueFbPids = [...new Set(recentFbProductIds)]
    const fbProducts = await db
      .select({ id: products.id, profile: products.profile })
      .from(products)
      .where(inArray(products.id, uniqueFbPids))
    
    for (const fb of userFeedback.slice(0, 10)) {
      const prod = fbProducts.find(p => p.id === fb.productId)
      const cat = (prod?.profile as any)?.category || (prod?.profile as any)?.productCategory
      if (cat && !recentCategories.includes(cat)) {
        recentCategories.push(cat)
      }
      if (recentCategories.length >= 5) break
    }
  }

  // ── 7. Engagement tier classification ───────────────────────
  const engagementScore = behavioralData.engagementScore || 0
  const totalEvents = behavioralData.totalEvents || 0

  const daysSinceLastActivity = behavioralData.lastActiveAt
    ? Math.floor((now.getTime() - new Date(behavioralData.lastActiveAt).getTime()) / (1000 * 60 * 60 * 24))
    : 999

  const engagementTier = classifyEngagementTier(
    engagementScore,
    totalEvents,
    daysSinceLastActivity,
    profile.onboardingComplete
  )

  // ── 8. Build the final vector ───────────────────────────────
  return {
    userId,
    demographics: {
      ageRange: demographics.ageRange || demographics.age || null,
      gender: demographics.gender || null,
      country: demographics.country || demographics.location || topCountry || null,
      city: demographics.city || null,
      profession: demographics.profession || null,
      education: demographics.education || null,
      incomeRange: personalizationConsent.allowed ? (sensitiveData.incomeRange || demographics.incomeRange || null) : null,
    },
    categoryScores,
    engagementTier,
    engagementScore,
    behavioral: {
      totalFeedbackGiven,
      avgRating,
      sentimentBias,
      feedbackFrequency,
      topDeviceType,
      topCountry: demographics.country || topCountry || null,
      activeDayParts,
      recentCategories,
      daysSinceLastActivity,
    },
    computedAt: now.toISOString(),
  }
}

// ── Helpers ───────────────────────────────────────────────────────

/**
 * Classify engagement tier based on score, events, and recency
 */
export function classifyEngagementTier(
  engagementScore: number,
  totalEvents: number,
  daysSinceLastActivity: number,
  onboardingComplete: boolean
): 'power' | 'active' | 'casual' | 'dormant' | 'new' {
  // Brand new users who haven't completed onboarding
  if (!onboardingComplete) return 'new'
  
  // Dormant: no activity in 30+ days regardless of past score
  if (daysSinceLastActivity > 30) return 'dormant'

  if (
    engagementScore >= ENGAGEMENT_TIERS.power.minScore &&
    totalEvents >= ENGAGEMENT_TIERS.power.minEvents
  ) return 'power'

  if (
    engagementScore >= ENGAGEMENT_TIERS.active.minScore &&
    totalEvents >= ENGAGEMENT_TIERS.active.minEvents
  ) return 'active'

  if (
    engagementScore >= ENGAGEMENT_TIERS.casual.minScore &&
    totalEvents >= ENGAGEMENT_TIERS.casual.minEvents
  ) return 'casual'

  return 'dormant'
}

/**
 * Build a default vector for a brand-new or profileless user
 */
function buildNewUserVector(userId: string): UserSignalVector {
  return {
    userId,
    demographics: {
      ageRange: null,
      gender: null,
      country: null,
      city: null,
      profession: null,
      education: null,
      incomeRange: null,
    },
    categoryScores: {},
    engagementTier: 'new',
    engagementScore: 0,
    behavioral: {
      totalFeedbackGiven: 0,
      avgRating: null,
      sentimentBias: 'unknown',
      feedbackFrequency: 'none',
      topDeviceType: null,
      topCountry: null,
      activeDayParts: [],
      recentCategories: [],
      daysSinceLastActivity: 999,
    },
    computedAt: new Date().toISOString(),
  }
}
