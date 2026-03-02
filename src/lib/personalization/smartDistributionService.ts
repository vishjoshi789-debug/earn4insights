import 'server-only'

import { db } from '@/db'
import { userProfiles, products, feedback, userEvents, notificationQueue, users } from '@/db/schema'
import { eq, and, sql, desc, gte, inArray, ne } from 'drizzle-orm'
import { checkConsent, type ConsentPurpose } from '@/lib/consent-enforcement'
import { aggregateUserSignals, type UserSignalVector } from './userSignalAggregator'

// ── Types ─────────────────────────────────────────────────────────

export type ConsumerScore = {
  userId: string
  email: string
  score: number
  breakdown: {
    interestMatch: number       // 0-25  Onboarding interests + behavioral category affinity
    demographicFit: number      // 0-20  Age, gender, education, location, profession
    engagementLevel: number     // 0-15  Feedback frequency, platform activity, tier
    behavioralSignals: number   // 0-15  Recent views, survey completions, feedback patterns
    culturalAlignment: number   // 0-10  Culture, aspirations, language match
    purchaseRelevance: number   // 0-10  Income fit, purchase history, spending capacity
    recencyBonus: number        // 0-5   Active in last 7 days
  }
  reasons: string[]
}

export type RelevanceResult = {
  score: number           // 0-100
  tier: 'high' | 'medium' | 'low' | 'unknown'
  breakdown: ConsumerScore['breakdown']
  reasons: string[]
}

// ── Score Weights (total = 100) ───────────────────────────────────

const WEIGHTS = {
  interestMatch: 25,
  demographicFit: 20,
  engagementLevel: 15,
  behavioralSignals: 15,
  culturalAlignment: 10,
  purchaseRelevance: 10,
  recencyBonus: 5,
} as const

// ── Find Ideal Consumers for a Product ────────────────────────────

/**
 * Finds the best-matched consumers for a product using ALL available
 * data points (respecting consent at every level).
 *
 * Data sources checked:
 *  1. userProfiles.demographics  → age, gender, location, education, profession
 *  2. userProfiles.interests     → productCategories, topics
 *  3. userProfiles.behavioral    → engagementScore, lastActiveAt, categoryInterests
 *  4. userProfiles.sensitiveData → incomeRange, purchaseHistory (only if personalization consent)
 *  5. userProfiles.consent       → gate for each data tier
 *  6. userEvents                 → product_view, survey_complete, feedback_submit, etc.
 *  7. feedback table             → past feedback history, ratings, sentiment
 *  8. Signal vector              → computed blended scores from aggregateUserSignals
 */
export async function findIdealConsumers(
  productId: string,
  maxResults: number = 50
): Promise<ConsumerScore[]> {
  // 1. Get the product profile
  const [product] = await db
    .select()
    .from(products)
    .where(eq(products.id, productId))
    .limit(1)

  if (!product) throw new Error(`Product ${productId} not found`)

  const productProfile = product.profile as any || {}
  const productCategory = productProfile.category || productProfile.productCategory
  const targetAudience = productProfile.targetAudience || {}

  // 2. Get all consumer users (exclude brand owner)
  const consumerUsers = await db
    .select({
      id: users.id,
      email: users.email,
      role: users.role,
    })
    .from(users)
    .where(
      and(
        eq(users.role, 'consumer'),
        ne(users.id, product.ownerId || '__none__')
      )
    )

  if (consumerUsers.length === 0) return []

  // 3. Batch-fetch all consumer profiles
  const consumerIds = consumerUsers.map(u => u.id)
  const profiles = await db
    .select()
    .from(userProfiles)
    .where(inArray(userProfiles.id, consumerIds))

  const profileMap = new Map(profiles.map(p => [p.id, p]))

  // 4. Score each consumer
  const scored: ConsumerScore[] = []

  for (const consumer of consumerUsers) {
    const profile = profileMap.get(consumer.id)
    
    // Skip consumers without any profile (no onboarding = no data to match)
    // But still allow them with a low score if they have events/feedback
    const hasProfile = !!profile

    // Check personalization consent before accessing personal data
    const personalizationConsent = hasProfile
      ? await checkConsent(consumer.id, 'personalization').catch(() => ({ allowed: false }))
      : { allowed: false }

    const trackingConsent = hasProfile
      ? await checkConsent(consumer.id, 'tracking').catch(() => ({ allowed: false }))
      : { allowed: false }

    const breakdown = {
      interestMatch: 0,
      demographicFit: 0,
      engagementLevel: 0,
      behavioralSignals: 0,
      culturalAlignment: 0,
      purchaseRelevance: 0,
      recencyBonus: 0,
    }
    const reasons: string[] = []

    if (hasProfile && personalizationConsent.allowed) {
      const demographics = (profile!.demographics as any) || {}
      const interests = (profile!.interests as any) || {}
      const behavioral = (profile!.behavioral as any) || {}
      const sensitiveData = (profile!.sensitiveData as any) || {}

      // ── A. Interest Match (0-25) ────────────────────────────
      // A1. Explicit interests from onboarding (0-15)
      const explicitCategories: string[] = interests.productCategories || []
      if (productCategory && explicitCategories.includes(productCategory)) {
        breakdown.interestMatch += 15
        reasons.push(`Interested in ${productCategory}`)
      } else if (productCategory) {
        // Partial match: check topic overlap
        const topics: string[] = interests.topics || []
        const productTags: string[] = productProfile.tags || productProfile.keywords || []
        const topicOverlap = topics.filter(t =>
          productTags.some((pt: string) => pt.toLowerCase().includes(t.toLowerCase()))
        )
        if (topicOverlap.length > 0) {
          breakdown.interestMatch += Math.min(topicOverlap.length * 4, 10)
          reasons.push(`Topic match: ${topicOverlap[0]}`)
        }
      }

      // A2. Behavioral category affinity (0-10) — learned from activity
      if (trackingConsent.allowed) {
        const categoryInterests = behavioral.categoryInterests || behavioral.interests || {}
        const affinityScore = categoryInterests[productCategory] || 0
        if (affinityScore > 0) {
          breakdown.interestMatch += Math.min(Math.round(affinityScore * 10), 10)
          if (affinityScore > 0.5) reasons.push('Behaviorally engaged with this category')
        }
      }

      // ── B. Demographic Fit (0-20) ──────────────────────────
      // B1. Age range (0-5)
      if (demographics.ageRange && targetAudience.ageRanges) {
        if (targetAudience.ageRanges.includes(demographics.ageRange)) {
          breakdown.demographicFit += 5
          reasons.push('Age group match')
        }
      }

      // B2. Gender (0-4)
      if (demographics.gender && targetAudience.genders) {
        if (targetAudience.genders.includes(demographics.gender) || targetAudience.genders.includes('all')) {
          breakdown.demographicFit += 4
        }
      }

      // B3. Location / Region (0-4)
      if (demographics.location && targetAudience.locations) {
        if (targetAudience.locations.includes(demographics.location)) {
          breakdown.demographicFit += 4
          reasons.push('In target region')
        }
      }

      // B4. Education level (0-3)
      if (demographics.education && targetAudience.educationLevels) {
        if (targetAudience.educationLevels.includes(demographics.education)) {
          breakdown.demographicFit += 3
        }
      }

      // B5. Profession / field of study (0-4)
      if (demographics.profession && targetAudience.professions) {
        if (targetAudience.professions.includes(demographics.profession)) {
          breakdown.demographicFit += 4
          reasons.push('Professional match')
        }
      } else if (demographics.fieldOfStudy && targetAudience.fields) {
        if (targetAudience.fields.includes(demographics.fieldOfStudy)) {
          breakdown.demographicFit += 3
        }
      }

      // ── C. Engagement Level (0-15) ─────────────────────────
      const engagementScore = behavioral.engagementScore || 0
      const surveyCompletionRate = behavioral.surveyCompletionRate || 0
      const productViewCount = behavioral.productViewCount || 0

      // C1. Engagement score (0-7)
      if (engagementScore >= 25) {
        breakdown.engagementLevel += 7
        reasons.push('Power user')
      } else if (engagementScore >= 10) {
        breakdown.engagementLevel += 5
      } else if (engagementScore >= 3) {
        breakdown.engagementLevel += 2
      }

      // C2. Survey completion rate (0-4) — reliable respondent signal
      if (surveyCompletionRate >= 0.8) {
        breakdown.engagementLevel += 4
        reasons.push('High survey completion rate')
      } else if (surveyCompletionRate >= 0.5) {
        breakdown.engagementLevel += 2
      }

      // C3. Platform activity volume (0-4)
      if (productViewCount >= 50) {
        breakdown.engagementLevel += 4
      } else if (productViewCount >= 20) {
        breakdown.engagementLevel += 2
      } else if (productViewCount >= 5) {
        breakdown.engagementLevel += 1
      }

      // ── D. Behavioral Signals (0-15) ───────────────────────
      if (trackingConsent.allowed) {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

        // D1. Viewed this specific product before (0-5)
        const [viewCount] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(userEvents)
          .where(
            and(
              eq(userEvents.userId, consumer.id),
              eq(userEvents.productId, productId),
              eq(userEvents.eventType, 'product_view')
            )
          )
        if (viewCount && viewCount.count > 0) {
          breakdown.behavioralSignals += 5
          reasons.push('Previously viewed this product')
        }

        // D2. Gave feedback on similar products (0-5)
        if (productCategory) {
          const similarFeedback = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(feedback)
            .innerJoin(products, eq(feedback.productId, products.id))
            .where(
              and(
                eq(feedback.userEmail, consumer.email),
                sql`${products.profile}->>'category' = ${productCategory}`,
                gte(feedback.createdAt, thirtyDaysAgo)
              )
            )
          if (similarFeedback[0] && similarFeedback[0].count > 0) {
            breakdown.behavioralSignals += Math.min(similarFeedback[0].count, 5)
            reasons.push('Active in this product category')
          }
        }

        // D3. Recent event activity in related categories (0-5)
        const recentEvents = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(userEvents)
          .where(
            and(
              eq(userEvents.userId, consumer.id),
              gte(userEvents.createdAt, thirtyDaysAgo)
            )
          )
        if (recentEvents[0] && recentEvents[0].count >= 20) {
          breakdown.behavioralSignals += 5
        } else if (recentEvents[0] && recentEvents[0].count >= 10) {
          breakdown.behavioralSignals += 3
        } else if (recentEvents[0] && recentEvents[0].count >= 3) {
          breakdown.behavioralSignals += 1
        }
      }

      // ── E. Cultural Alignment (0-10) ───────────────────────
      // E1. Culture match (0-5)
      if (demographics.culture && productProfile.culturalRelevance) {
        const match = productProfile.culturalRelevance[demographics.culture]
        if (match === 'high') {
          breakdown.culturalAlignment += 5
          reasons.push('Culturally aligned')
        } else if (match === 'medium') {
          breakdown.culturalAlignment += 3
        }
      }

      // E2. Language match (0-3)
      if (demographics.language && productProfile.languages) {
        if (productProfile.languages.includes(demographics.language)) {
          breakdown.culturalAlignment += 3
        }
      }

      // E3. Aspirations overlap (0-2)
      if (demographics.aspirations && productProfile.aspirationAlignment) {
        const userAsps: string[] = demographics.aspirations || []
        const productAsps: string[] = productProfile.aspirationAlignment || []
        const overlap = userAsps.filter(a => productAsps.includes(a))
        if (overlap.length > 0) {
          breakdown.culturalAlignment += 2
          reasons.push(`Aligns with ${overlap[0]} goals`)
        }
      }

      // ── F. Purchase Relevance (0-10) — consent-gated ──────
      if (sensitiveData && personalizationConsent.allowed) {
        // F1. Income range vs product price segment (0-5)
        if (sensitiveData.incomeRange && productProfile.priceSegment) {
          const incomeMap: Record<string, string[]> = {
            'budget': ['0-25k', '25k-50k'],
            'mid-range': ['25k-50k', '50k-100k', '100k-200k'],
            'premium': ['100k-200k', '200k+'],
            'luxury': ['200k+'],
          }
          const matchIncomes = incomeMap[productProfile.priceSegment] || []
          if (matchIncomes.includes(sensitiveData.incomeRange)) {
            breakdown.purchaseRelevance += 5
            reasons.push('Budget fit')
          }
        }

        // F2. Past purchase categories (0-3)
        if (sensitiveData.purchaseHistory?.amazonCategories && productCategory) {
          if (sensitiveData.purchaseHistory.amazonCategories.includes(productCategory)) {
            breakdown.purchaseRelevance += 3
            reasons.push('Bought similar products before')
          }
        }

        // F3. Purchase frequency alignment (0-2)
        if (sensitiveData.purchaseHistory?.frequency && productProfile.targetFrequency) {
          if (sensitiveData.purchaseHistory.frequency === productProfile.targetFrequency) {
            breakdown.purchaseRelevance += 2
          }
        }
      }

      // ── G. Recency Bonus (0-5) ─────────────────────────────
      const lastActive = behavioral.lastActiveAt
        ? new Date(behavioral.lastActiveAt)
        : null
      if (lastActive) {
        const daysSince = (Date.now() - lastActive.getTime()) / (1000 * 60 * 60 * 24)
        if (daysSince <= 3) {
          breakdown.recencyBonus += 5
          reasons.push('Active in last 3 days')
        } else if (daysSince <= 7) {
          breakdown.recencyBonus += 3
        } else if (daysSince <= 14) {
          breakdown.recencyBonus += 1
        }
      }
    }

    // Calculate total score
    const totalScore = Math.min(
      breakdown.interestMatch +
      breakdown.demographicFit +
      breakdown.engagementLevel +
      breakdown.behavioralSignals +
      breakdown.culturalAlignment +
      breakdown.purchaseRelevance +
      breakdown.recencyBonus,
      100
    )

    // Only include if there's some signal (score > 0)
    if (totalScore > 0) {
      scored.push({
        userId: consumer.id,
        email: consumer.email,
        score: totalScore,
        breakdown,
        reasons,
      })
    }
  }

  // Sort by score descending, return top N
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)
}

// ── Compute Relevance Score for Feedback ──────────────────────────

/**
 * When a consumer submits feedback, compute how "relevant" they are
 * to that product — so brands know the quality of the feedback source.
 *
 * Uses the same data points as findIdealConsumers but for a single
 * consumer-product pair.
 */
export async function computeRelevanceScore(
  consumerEmail: string,
  productId: string
): Promise<RelevanceResult> {
  // Find the consumer's user record
  const [user] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.email, consumerEmail))
    .limit(1)

  if (!user) {
    return {
      score: 0,
      tier: 'unknown',
      breakdown: emptyBreakdown(),
      reasons: ['User profile not found'],
    }
  }

  // Get the product
  const [product] = await db
    .select()
    .from(products)
    .where(eq(products.id, productId))
    .limit(1)

  if (!product) {
    return {
      score: 0,
      tier: 'unknown',
      breakdown: emptyBreakdown(),
      reasons: ['Product not found'],
    }
  }

  // Use findIdealConsumers logic but for a single user
  // Build a mini-scored result using the same comprehensive checks
  const result = await findIdealConsumers(productId, 999)
  const match = result.find(r => r.userId === user.id)

  if (match) {
    return {
      score: match.score,
      tier: match.score >= 60 ? 'high' : match.score >= 30 ? 'medium' : 'low',
      breakdown: match.breakdown,
      reasons: match.reasons,
    }
  }

  // User wasn't in the scored list — they have no matching data points
  return {
    score: 5, // Minimum — they still gave feedback
    tier: 'low',
    breakdown: emptyBreakdown(),
    reasons: ['No matching profile data — consider completing onboarding for higher relevance'],
  }
}

// ── Notify Ideal Consumers ────────────────────────────────────────

/**
 * Create in-app notifications for the top-matched consumers
 * when a brand launches a new product or survey.
 */
export async function notifyIdealConsumers(
  productId: string,
  notificationType: 'product_launch' | 'new_survey',
  opts: {
    surveyId?: string
    surveyTitle?: string
    maxNotifications?: number
  } = {}
): Promise<{ notified: number; topScores: number[] }> {
  const maxNotify = opts.maxNotifications || 50

  // 1. Find ideal consumers
  const idealConsumers = await findIdealConsumers(productId, maxNotify)

  if (idealConsumers.length === 0) {
    return { notified: 0, topScores: [] }
  }

  // 2. Get product name for notification text
  const [product] = await db
    .select({ name: products.name })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1)

  const productName = product?.name || 'a new product'

  // 3. Build notification messages
  const now = new Date()
  const notifications = idealConsumers.map(consumer => {
    const subject = notificationType === 'product_launch'
      ? `🚀 New product matching your interests: ${productName}`
      : `📋 New survey for you: ${opts.surveyTitle || productName}`

    const body = notificationType === 'product_launch'
      ? `A new product in a category you follow has just launched! Check out "${productName}" and share your insights to earn rewards.`
      : `A survey about "${productName}" is looking for feedback from people like you. Complete it to earn rewards!`

    return {
      userId: consumer.userId,
      channel: 'email' as const,
      type: notificationType,
      status: 'pending' as const,
      priority: consumer.score >= 60 ? 1 : consumer.score >= 30 ? 3 : 5,
      subject,
      body,
      metadata: {
        productId,
        surveyId: opts.surveyId || null,
        relevanceScore: consumer.score,
        matchReasons: consumer.reasons,
      },
      scheduledFor: now,
    }
  })

  // 4. Batch insert notifications
  if (notifications.length > 0) {
    await db.insert(notificationQueue).values(notifications)
  }

  return {
    notified: notifications.length,
    topScores: idealConsumers.slice(0, 5).map(c => c.score),
  }
}

// ── Helpers ───────────────────────────────────────────────────────

function emptyBreakdown(): ConsumerScore['breakdown'] {
  return {
    interestMatch: 0,
    demographicFit: 0,
    engagementLevel: 0,
    behavioralSignals: 0,
    culturalAlignment: 0,
    purchaseRelevance: 0,
    recencyBonus: 0,
  }
}

// ── Direct Trigger Functions (for server actions — no fetch needed) ──

/**
 * Call directly from server actions after a brand launches a product.
 * Finds ideal consumers and queues notifications.
 */
export async function triggerProductLaunchNotifications(
  productId: string
): Promise<{ notified: number; topScores: number[] }> {
  return notifyIdealConsumers(productId, 'product_launch')
}

/**
 * Call directly from server actions after a brand creates/activates a survey.
 * Finds ideal consumers for the survey's product and queues notifications.
 */
export async function triggerSurveyNotifications(
  productId: string,
  surveyId: string,
  surveyTitle: string
): Promise<{ notified: number; topScores: number[] }> {
  return notifyIdealConsumers(productId, 'new_survey', {
    surveyId,
    surveyTitle,
  })
}
