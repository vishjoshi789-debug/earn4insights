import { db } from '@/db'
import { userEvents, userProfiles } from '@/db/schema'
import { eq, and, gte, desc, sql, inArray } from 'drizzle-orm'
import { analyzeSentiment } from './sentimentService'
import { checkConsent } from '@/lib/consent-enforcement'

/**
 * Event Aggregation Service
 * Processes user_events to generate behavioral insights
 */

/**
 * Get event counts by type for a user
 */
export async function getUserEventCounts(
  userId: string,
  daysAgo: number = 90
): Promise<Record<string, number>> {
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - daysAgo)

  const results = await db
    .select({
      eventType: userEvents.eventType,
      count: sql<number>`count(*)::int`
    })
    .from(userEvents)
    .where(
      and(
        eq(userEvents.userId, userId),
        gte(userEvents.createdAt, cutoffDate)
      )
    )
    .groupBy(userEvents.eventType)

  const counts: Record<string, number> = {}
  results.forEach(r => {
    counts[r.eventType] = r.count
  })
  
  return counts
}

/**
 * Calculate user engagement score
 * Based on weighted event types with time decay
 */
export async function calculateUserEngagement(userId: string): Promise<number> {
  const ninetyDaysAgo = new Date()
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

  const events = await db
    .select()
    .from(userEvents)
    .where(
      and(
        eq(userEvents.userId, userId),
        gte(userEvents.createdAt, ninetyDaysAgo)
      )
    )

  let score = 0
  const now = Date.now()

  // Event weights
  const weights: Record<string, number> = {
    product_view: 0.1,
    survey_start: 0.5,
    survey_complete: 2.0,
    feedback_submit: 1.5,
    onboarding_complete: 3.0,
    profile_update: 1.0,
    rankings_view: 0.2,
    social_post_view: 0.1,
    social_post_like: 0.3,
    social_comment_submit: 1.0,
    notification_click: 0.3,
    community_feature_view: 0.2,
  }

  for (const event of events) {
    const eventDate = new Date(event.createdAt).getTime()
    const daysAgo = (now - eventDate) / (1000 * 60 * 60 * 24)

    // Time decay: 100% for 0-30 days, 50% for 30-60 days, 25% for 60-90 days
    let decayFactor = 1
    if (daysAgo > 60) decayFactor = 0.25
    else if (daysAgo > 30) decayFactor = 0.5

    const points = weights[event.eventType] || 0.05
    score += points * decayFactor
  }

  return Math.round(score * 10) / 10
}

/**
 * Calculate interest scores by product category
 * Based on product views, survey completions, and engagement
 */
export async function calculateCategoryInterests(
  userId: string
): Promise<Record<string, number>> {
  const ninetyDaysAgo = new Date()
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

  const events = await db
    .select()
    .from(userEvents)
    .where(
      and(
        eq(userEvents.userId, userId),
        gte(userEvents.createdAt, ninetyDaysAgo),
        inArray(userEvents.eventType, ['product_view', 'survey_complete', 'feedback_submit'])
      )
    )

  const categoryScores: Record<string, number> = {}

  for (const event of events) {
    const metadata = event.metadata as any
    const category = metadata?.category

    if (!category) continue

    // Weight different event types
    let weight = 1
    if (event.eventType === 'survey_complete') weight = 3
    if (event.eventType === 'feedback_submit') weight = 2

    categoryScores[category] = (categoryScores[category] || 0) + weight
  }

  // Normalize to 0-1 scale
  const maxScore = Math.max(...Object.values(categoryScores), 1)
  const normalized: Record<string, number> = {}
  
  for (const [category, score] of Object.entries(categoryScores)) {
    normalized[category] = Math.round((score / maxScore) * 100) / 100
  }

  return normalized
}

/**
 * Calculate survey completion rate
 */
export async function calculateSurveyCompletionRate(userId: string): Promise<number> {
  const counts = await getUserEventCounts(userId, 90)
  
  const starts = counts['survey_start'] || 0
  const completions = counts['survey_complete'] || 0

  if (starts === 0) return 0
  return Math.round((completions / starts) * 100)
}

/**
 * Get user's most active times (hour of day)
 * Returns array of hours (0-23) sorted by activity
 */
export async function getUserActiveHours(userId: string): Promise<number[]> {
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const events = await db
    .select({
      hour: sql<number>`EXTRACT(HOUR FROM created_at)::int`,
      count: sql<number>`count(*)::int`
    })
    .from(userEvents)
    .where(
      and(
        eq(userEvents.userId, userId),
        gte(userEvents.createdAt, thirtyDaysAgo)
      )
    )
    .groupBy(sql`EXTRACT(HOUR FROM created_at)`)
    .orderBy(desc(sql`count(*)`))

  return events.map(e => e.hour)
}

/**
 * Update user's behavioral attributes in profile
 * Should be run periodically (daily or weekly)
 * REQUIRES: tracking + analytics consent
 */
export async function updateUserBehavioralAttributes(userId: string): Promise<void> {
  try {
    // ✅ CONSENT CHECK: Require both tracking and analytics consent
    const trackingConsent = await checkConsent(userId, 'tracking')
    const analyticsConsent = await checkConsent(userId, 'analytics')
    
    if (!trackingConsent.allowed || !analyticsConsent.allowed) {
      console.log(`[Analytics] Skipping behavioral update for user ${userId} - missing consent (tracking: ${trackingConsent.allowed}, analytics: ${analyticsConsent.allowed})`)
      return
    }

    const [
      engagementScore,
      categoryInterests,
      completionRate,
      eventCounts,
      activeHours
    ] = await Promise.all([
      calculateUserEngagement(userId),
      calculateCategoryInterests(userId),
      calculateSurveyCompletionRate(userId),
      getUserEventCounts(userId, 90),
      getUserActiveHours(userId)
    ])

    const behavioral = {
      engagementScore,
      lastActiveAt: new Date().toISOString(),
      surveyCompletionRate: completionRate,
      productViewCount: eventCounts['product_view'] || 0,
      categoryInterests,
      activeHours: activeHours.slice(0, 5), // Top 5 active hours
      totalEvents: Object.values(eventCounts).reduce((sum, count) => sum + count, 0)
    }

    await db
      .update(userProfiles)
      .set({
        behavioral,
        updatedAt: new Date()
      })
      .where(eq(userProfiles.id, userId))

    console.log(`[Analytics] Updated behavioral attributes for user ${userId}`)
  } catch (error) {
    console.error(`[Analytics] Error updating behavioral attributes:`, error)
    throw error
  }
}

/**
 * Batch update behavioral attributes for all active users
 * Run this as a background job
 */
export async function batchUpdateBehavioralAttributes(): Promise<void> {
  // Get all users with events in last 90 days
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const activeUsers = await db
    .selectDistinct({ userId: userEvents.userId })
    .from(userEvents)
    .where(gte(userEvents.createdAt, thirtyDaysAgo))

  console.log(`[Analytics] Processing ${activeUsers.length} active users`)

  for (const { userId } of activeUsers) {
    try {
      await updateUserBehavioralAttributes(userId)
    } catch (error) {
      console.error(`[Analytics] Failed to update user ${userId}:`, error)
    }
  }

  console.log(`[Analytics] Batch update complete`)
}
