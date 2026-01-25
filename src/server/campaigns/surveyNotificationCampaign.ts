'use server'

import { queueNotification } from '@/server/notificationService'
import { getUserProfile } from '@/db/repositories/userProfileRepository'
import { getSurveyById } from '@/db/repositories/surveyRepository'
import { getProductById } from '@/db/repositories/productRepository'

/**
 * Send "New Survey Available" notification to targeted users
 * 
 * Targeting Rules (Phase 1 - Rule-based):
 * - User has email enabled
 * - User has consented to personalization OR marketing
 * - User's interests match survey category (if specified)
 * - User's demographics match survey filters (if specified)
 */
export async function notifyNewSurvey(surveyId: string, options?: {
  targetUserIds?: string[] // Specific users to notify
  categoryFilter?: string // Only notify users interested in this category
  demographicFilters?: {
    ageRange?: string
    location?: string
    gender?: string
  }
}) {
  try {
    // Get survey details
    const survey = await getSurveyById(surveyId)
    if (!survey) {
      return { success: false, error: 'Survey not found' }
    }

    // Get product details
    const product = await getProductById(survey.productId)
    if (!product) {
      return { success: false, error: 'Product not found' }
    }

    let notificationsSent = 0
    const errors: string[] = []

    // Determine which users to notify
    const targetUsers = options?.targetUserIds || []

    if (targetUsers.length === 0) {
      // TODO: In Phase 2, query all users and filter by targeting rules
      console.log('[NotifyCampaign] No specific users targeted, skipping for now')
      return {
        success: true,
        notificationsSent: 0,
        message: 'Notification campaign configured but no users targeted yet. Add user targeting in Phase 2.'
      }
    }

    // Send notification to each targeted user
    for (const userId of targetUsers) {
      try {
        // Get user profile
        const profile = await getUserProfile(userId)
        if (!profile) {
          errors.push(`User ${userId}: Profile not found`)
          continue
        }

        // Check consent
        const consent = profile.consent as any
        if (!consent?.personalization && !consent?.marketing) {
          console.log(`[NotifyCampaign] User ${userId} has not consented to notifications`)
          continue
        }

        // Check channel preference
        const prefs = profile.notificationPreferences as any
        if (!prefs?.email?.enabled) {
          console.log(`[NotifyCampaign] User ${userId} has email disabled`)
          continue
        }

        // Apply demographic filters (if specified)
        if (options?.demographicFilters) {
          const demographics = profile.demographics as any
          const filters = options.demographicFilters

          if (filters.ageRange && demographics?.ageRange !== filters.ageRange) {
            console.log(`[NotifyCampaign] User ${userId} filtered by ageRange`)
            continue
          }

          if (filters.location && demographics?.location !== filters.location) {
            console.log(`[NotifyCampaign] User ${userId} filtered by location`)
            continue
          }

          if (filters.gender && demographics?.gender !== filters.gender) {
            console.log(`[NotifyCampaign] User ${userId} filtered by gender`)
            continue
          }
        }

        // Apply category filter (if specified)
        if (options?.categoryFilter) {
          const interests = profile.interests as any
          const userCategories = interests?.productCategories || []
          
          if (!userCategories.includes(options.categoryFilter)) {
            console.log(`[NotifyCampaign] User ${userId} not interested in ${options.categoryFilter}`)
            continue
          }
        }

        // Generate email content
        const subject = `New Survey Available: Help ${product.name} Improve!`
        const body = `
          <h2>We'd love your feedback!</h2>
          <p>Hi there,</p>
          <p>${product.name} has launched a new survey: <strong>${survey.title}</strong></p>
          <p>${survey.description || 'Share your thoughts and earn rewards!'}</p>
          <p>
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/survey/${surveyId}" style="background-color: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 16px;">
              Take the Survey
            </a>
          </p>
          <p style="margin-top: 24px; font-size: 12px; color: #666;">
            This survey takes about 5 minutes. You'll earn points that can be redeemed for rewards.
          </p>
          <hr style="margin: 24px 0; border: none; border-top: 1px solid #ddd;" />
          <p style="font-size: 11px; color: #999;">
            You're receiving this because you opted in to survey notifications. 
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/settings/privacy" style="color: #666;">Manage your preferences</a>
          </p>
        `

        // Queue notification
        const notificationId = await queueNotification({
          userId,
          channel: 'email',
          type: 'new_survey',
          subject,
          body,
          metadata: {
            surveyId,
            productId: product.id,
            category: options?.categoryFilter
          },
          priority: 5 // Normal priority
        })

        if (notificationId) {
          notificationsSent++
        } else {
          errors.push(`User ${userId}: Failed to queue notification`)
        }

      } catch (error) {
        errors.push(`User ${userId}: ${String(error)}`)
      }
    }

    return {
      success: true,
      notificationsSent,
      errors: errors.length > 0 ? errors : undefined,
      message: `Queued ${notificationsSent} notifications for survey: ${survey.title}`
    }

  } catch (error) {
    console.error('[NotifyCampaign] Error:', error)
    return {
      success: false,
      error: String(error)
    }
  }
}

/**
 * Send test notification to a single user (for testing)
 */
export async function sendTestSurveyNotification(userId: string, surveyId: string) {
  return await notifyNewSurvey(surveyId, {
    targetUserIds: [userId]
  })
}
