import { db } from '@/db'
import { userEvents, type NewUserEvent } from '@/db/schema'
import { hasConsent } from '@/db/repositories/userProfileRepository'
import { eq, and, gte, desc } from 'drizzle-orm'

/**
 * Allowed event types - Whitelist for validation
 */
const ALLOWED_EVENT_TYPES = [
  // Product events
  'product_view',
  // Survey events
  'survey_start',
  'survey_complete',
  // Notification events
  'notification_click',
  'notification_view',
  // Feedback events
  'feedback_submit',
  // Profile events
  'onboarding_complete',
  'profile_update',
  'privacy_settings_update',
  // Social events
  'social_post_view',
  'social_post_like',
  'social_comment_submit',
  // Rankings events
  'rankings_view',
  // Community events
  'community_feature_view',
] as const

type AllowedEventType = typeof ALLOWED_EVENT_TYPES[number]

/**
 * Validate event type
 */
function isValidEventType(eventType: string): eventType is AllowedEventType {
  return ALLOWED_EVENT_TYPES.includes(eventType as AllowedEventType)
}

/**
 * Sanitize metadata to prevent malicious input
 */
function sanitizeMetadata(metadata?: Record<string, any>): Record<string, any> | null {
  if (!metadata) return null

  const sanitized: Record<string, any> = {}
  
  for (const [key, value] of Object.entries(metadata)) {
    // Skip null/undefined
    if (value === null || value === undefined) continue
    
    // Only allow primitive types and plain objects/arrays
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      sanitized[key] = value
    } else if (Array.isArray(value)) {
      sanitized[key] = value.filter(v => 
        typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'
      )
    } else if (typeof value === 'object') {
      // Only include plain objects (not class instances)
      sanitized[key] = JSON.parse(JSON.stringify(value))
    }
  }

  return Object.keys(sanitized).length > 0 ? sanitized : null
}

/**
 * Validate required fields based on event type
 */
function validateEventData(eventType: string, metadata?: Record<string, any>): string | null {
  switch (eventType) {
    case 'product_view':
      if (!metadata?.productId) return 'productId is required for product_view events'
      break
    case 'survey_start':
    case 'survey_complete':
      if (!metadata?.surveyId) return 'surveyId is required for survey events'
      break
    case 'notification_click':
    case 'notification_view':
      if (!metadata?.notificationId) return 'notificationId is required for notification events'
      break
    case 'feedback_submit':
      if (!metadata?.productId) return 'productId is required for feedback_submit events'
      break
    case 'social_post_view':
    case 'social_post_like':
    case 'social_comment_submit':
      if (!metadata?.postId) return 'postId is required for social events'
      if (!metadata?.productId) return 'productId is required for social events'
      break
  }
  return null
}

/**
 * Track a user event (with consent check and validation)
 */
export async function trackEvent(
  userId: string,
  eventType: string,
  metadata?: {
    productId?: string
    surveyId?: string
    notificationId?: string
    sessionId?: string
    [key: string]: any
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    // Validate user ID
    if (!userId || typeof userId !== 'string') {
      console.error('[EventTracking] Invalid userId')
      return { success: false, error: 'Invalid userId' }
    }

    // Validate event type
    if (!isValidEventType(eventType)) {
      console.error(`[EventTracking] Invalid event type: ${eventType}`)
      return { success: false, error: `Invalid event type: ${eventType}` }
    }

    // Validate required fields
    const validationError = validateEventData(eventType, metadata)
    if (validationError) {
      console.error(`[EventTracking] Validation error: ${validationError}`)
      return { success: false, error: validationError }
    }

    // Check if user has consented to tracking
    const hasTrackingConsent = await hasConsent(userId, 'tracking')
    if (!hasTrackingConsent) {
      console.log(`[EventTracking] User ${userId} has not consented to tracking`)
      return { success: false, error: 'User has not consented to tracking' }
    }

    // Sanitize metadata
    const sanitizedMetadata = sanitizeMetadata(metadata)

    const event: NewUserEvent = {
      userId,
      eventType,
      productId: metadata?.productId || null,
      surveyId: metadata?.surveyId || null,
      notificationId: metadata?.notificationId || null,
      sessionId: metadata?.sessionId || null,
      metadata: sanitizedMetadata
    }

    await db.insert(userEvents).values(event)
    console.log(`[EventTracking] ✓ Tracked: ${eventType} for user ${userId}`)
    
    return { success: true }
  } catch (error) {
    console.error(`[EventTracking] Error tracking event:`, error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

/**
 * Get recent events for a user
 */
export async function getUserEvents(
  userId: string,
  limit: number = 50
) {
  return await db
    .select()
    .from(userEvents)
    .where(eq(userEvents.userId, userId))
    .orderBy(desc(userEvents.createdAt))
    .limit(limit)
}

/**
 * Get events by type for a user
 */
export async function getUserEventsByType(
  userId: string,
  eventType: string,
  limit: number = 50
) {
  return await db
    .select()
    .from(userEvents)
    .where(
      and(
        eq(userEvents.userId, userId),
        eq(userEvents.eventType, eventType)
      )
    )
    .orderBy(desc(userEvents.createdAt))
    .limit(limit)
}

/**
 * Calculate engagement score for a user (Phase 2 - for now return 0)
 * 
 * Engagement score = weighted sum of:
 * - Product views (0.1 points each)
 * - Survey starts (0.5 points each)
 * - Survey completions (2 points each)
 * - Notification clicks (0.3 points each)
 * - Time decay (50% after 30 days, 25% after 60 days)
 */
export async function calculateEngagementScore(userId: string): Promise<number> {
  // Get events from last 90 days
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

  for (const event of events) {
    const eventDate = new Date(event.createdAt).getTime()
    const daysAgo = (now - eventDate) / (1000 * 60 * 60 * 24)

    // Time decay factor
    let decayFactor = 1
    if (daysAgo > 60) decayFactor = 0.25
    else if (daysAgo > 30) decayFactor = 0.5

    // Event weights
    let points = 0
    switch (event.eventType) {
      case 'product_view':
        points = 0.1
        break
      case 'survey_start':
        points = 0.5
        break
      case 'survey_complete':
        points = 2.0
        break
      case 'notification_click':
        points = 0.3
        break
      default:
        points = 0.05
    }

    score += points * decayFactor
  }

  return Math.round(score * 10) / 10 // Round to 1 decimal
}

/**
 * Calculate survey completion rate
 */
export async function calculateSurveyCompletionRate(userId: string): Promise<number> {
  const ninetyDaysAgo = new Date()
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

  const allEvents = await db
    .select()
    .from(userEvents)
    .where(
      and(
        eq(userEvents.userId, userId),
        gte(userEvents.createdAt, ninetyDaysAgo)
      )
    )

  const starts = allEvents.filter(e => e.eventType === 'survey_start').length
  const completions = allEvents.filter(e => e.eventType === 'survey_complete').length

  if (starts === 0) return 0
  return Math.round((completions / starts) * 100)
}

/**
 * Get product view count
 */
export async function getProductViewCount(userId: string): Promise<number> {
  const views = await getUserEventsByType(userId, 'product_view', 1000)
  return views.length
}

/**
 * Calculate interest scores by category (Phase 2 - for now return empty)
 * 
 * Interest score = frequency of interactions with products in that category
 */
export async function calculateInterestScores(userId: string): Promise<Record<string, number>> {
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

  // Count interactions by product/category
  const categoryInteractions: Record<string, number> = {}

  for (const event of events) {
    if (event.metadata && typeof event.metadata === 'object') {
      const metadata = event.metadata as any
      const category = metadata.category
      if (category) {
        categoryInteractions[category] = (categoryInteractions[category] || 0) + 1
      }
    }
  }

  // Normalize to 0-1 scale
  const maxInteractions = Math.max(...Object.values(categoryInteractions), 1)
  const normalized: Record<string, number> = {}
  for (const [category, count] of Object.entries(categoryInteractions)) {
    normalized[category] = Math.round((count / maxInteractions) * 100) / 100
  }

  return normalized
}

/**
 * Convenience functions for common events
 */
// Product tracking
export const trackProductView = (userId: string, productId: string, sessionId?: string, category?: string) =>
  trackEvent(userId, 'product_view', { productId, sessionId, category })

// Survey tracking
export const trackSurveyStart = (userId: string, surveyId: string, sessionId?: string) =>
  trackEvent(userId, 'survey_start', { surveyId, sessionId })

export const trackSurveyComplete = (userId: string, surveyId: string, sessionId?: string) =>
  trackEvent(userId, 'survey_complete', { surveyId, sessionId })

// Notification tracking
export const trackNotificationClick = (userId: string, notificationId: string) =>
  trackEvent(userId, 'notification_click', { notificationId })

export const trackNotificationView = (userId: string, notificationId: string) =>
  trackEvent(userId, 'notification_view', { notificationId })

// Feedback tracking
export const trackFeedbackSubmit = (userId: string, productId: string, rating?: number, category?: string) =>
  trackEvent(userId, 'feedback_submit', { productId, rating, category })

// Profile tracking
export const trackOnboardingComplete = (userId: string, demographics: any, interests: any) =>
  trackEvent(userId, 'onboarding_complete', { demographics, interests })

export const trackProfileUpdate = (userId: string, field: string, oldValue: any, newValue: any) =>
  trackEvent(userId, 'profile_update', { field, oldValue, newValue })

export const trackPrivacySettingsUpdate = (userId: string, settings: any) =>
  trackEvent(userId, 'privacy_settings_update', { settings })

// Social tracking
export const trackSocialPostView = (userId: string, postId: string, productId: string) =>
  trackEvent(userId, 'social_post_view', { postId, productId })

export const trackSocialPostLike = (userId: string, postId: string, productId: string) =>
  trackEvent(userId, 'social_post_like', { postId, productId })

export const trackSocialCommentSubmit = (userId: string, postId: string, productId: string) =>
  trackEvent(userId, 'social_comment_submit', { postId, productId })

// Rankings tracking
export const trackRankingsView = (userId: string, category?: string) =>
  trackEvent(userId, 'rankings_view', { category })

// Community tracking
export const trackCommunityFeatureView = (userId: string, feature: string) =>
  trackEvent(userId, 'community_feature_view', { feature })
