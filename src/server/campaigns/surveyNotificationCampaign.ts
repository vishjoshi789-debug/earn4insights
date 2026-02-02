'use server'

import { queueNotification } from '@/server/notificationService'
import { getUserProfile } from '@/db/repositories/userProfileRepository'
import { getSurveyById } from '@/db/repositories/surveyRepository'
import { getProductById } from '@/db/repositories/productRepository'

/**
 * Calculate optimal send time based on user's activity patterns
 */
function calculateOptimalSendTime(userId: string, profile: any): Date {
  const now = new Date()
  const prefs = profile.notificationPreferences as any
  const behavioral = profile.behavioral as any

  // Check quiet hours
  const quietHours = prefs?.email?.quietHours
  if (quietHours) {
    const currentHour = now.getHours()
    const quietStart = parseInt(quietHours.start?.split(':')[0] || '22')
    const quietEnd = parseInt(quietHours.end?.split(':')[0] || '8')

    // If in quiet hours, schedule for end of quiet period
    if (quietEnd > quietStart) {
      // Normal case: quiet hours don't cross midnight
      if (currentHour >= quietStart || currentHour < quietEnd) {
        const scheduledTime = new Date(now)
        scheduledTime.setHours(quietEnd, 0, 0, 0)
        if (scheduledTime < now) {
          scheduledTime.setDate(scheduledTime.getDate() + 1)
        }
        return scheduledTime
      }
    } else {
      // Quiet hours cross midnight
      if (currentHour >= quietStart && currentHour < quietEnd) {
        const scheduledTime = new Date(now)
        scheduledTime.setHours(quietEnd, 0, 0, 0)
        if (scheduledTime < now) {
          scheduledTime.setDate(scheduledTime.getDate() + 1)
        }
        return scheduledTime
      }
    }
  }

  // TODO: Analyze user's event timestamps to find peak activity hours
  // For now, use safe default times: 10am-2pm or 6pm-8pm
  const currentHour = now.getHours()
  
  // If current time is within active hours, send now
  if ((currentHour >= 10 && currentHour < 14) || (currentHour >= 18 && currentHour < 20)) {
    return now
  }

  // Otherwise schedule for next active period
  const scheduledTime = new Date(now)
  if (currentHour < 10) {
    scheduledTime.setHours(10, 0, 0, 0)
  } else if (currentHour >= 14 && currentHour < 18) {
    scheduledTime.setHours(18, 0, 0, 0)
  } else {
    // After 8pm, schedule for tomorrow 10am
    scheduledTime.setDate(scheduledTime.getDate() + 1)
    scheduledTime.setHours(10, 0, 0, 0)
  }

  return scheduledTime
}

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
  behavioralFilters?: {
    minEngagementScore?: number // Only notify engaged users (0-1)
    minCategoryInterest?: number // Minimum interest in category (0-1)
    excludeInactive?: boolean // Skip users with no recent activity
  }
  sendTimeOptimization?: boolean // Schedule for optimal send time
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

        // Apply behavioral filters (Phase 2 - Behavior-based targeting)
        if (options?.behavioralFilters) {
          const behavioral = profile.behavioral as any
          const filters = options.behavioralFilters

          // Check engagement score
          if (filters.minEngagementScore && behavioral?.engagementScore) {
            if (behavioral.engagementScore < filters.minEngagementScore) {
              console.log(`[NotifyCampaign] User ${userId} engagement too low: ${behavioral.engagementScore}`)
              continue
            }
          }

          // Check category interest (learned from behavior)
          if (filters.minCategoryInterest && options.categoryFilter && behavioral?.categoryInterests) {
            const categoryInterest = behavioral.categoryInterests[options.categoryFilter] || 0
            if (categoryInterest < filters.minCategoryInterest) {
              console.log(`[NotifyCampaign] User ${userId} low interest in ${options.categoryFilter}: ${categoryInterest}`)
              continue
            }
          }

          // Exclude inactive users
          if (filters.excludeInactive && behavioral?.lastActiveAt) {
            const daysSinceActive = (Date.now() - new Date(behavioral.lastActiveAt).getTime()) / (1000 * 60 * 60 * 24)
            if (daysSinceActive > 30) {
              console.log(`[NotifyCampaign] User ${userId} inactive for ${daysSinceActive.toFixed(0)} days`)
              continue
            }
          }
        }

        // Determine optimal send time (if enabled)
        let scheduledFor = new Date()
        if (options?.sendTimeOptimization) {
          scheduledFor = calculateOptimalSendTime(userId, profile)
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
          priority: 5, // Normal priority
          scheduledFor // Use calculated optimal send time
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
