'use server'

import { queueNotification } from '@/server/notificationService'
import { getUserProfile } from '@/db/repositories/userProfileRepository'
import { getSurveyById } from '@/db/repositories/surveyRepository'
import { getProductById } from '@/db/repositories/productRepository'
import { 
  getOptimalSendHour, 
  assignUserToCohort,
  trackEmailSend 
} from '@/lib/send-time-optimizer'

/**
 * Calculate optimal send time using intelligent send-time optimization
 * 
 * Decision logic:
 * 1. If optimization enabled (variance >30%): Use personalized send times
 * 2. If optimization disabled (variance <15%): Use random timing
 * 3. Respects user quiet hours
 * 4. Assigns user to cohort for A/B testing
 */
async function calculateOptimalSendTime(userId: string, profile: any): Promise<Date> {
  const now = new Date()
  const prefs = profile.notificationPreferences as any

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

  // Assign user to cohort for A/B testing
  await assignUserToCohort(userId)

  // Get optimal send hour from intelligent optimizer
  const optimalHour = await getOptimalSendHour(userId)
  
  // Schedule for optimal hour
  const scheduledTime = new Date(now)
  const currentHour = now.getHours()
  
  if (currentHour < optimalHour) {
    // Send today at optimal hour
    scheduledTime.setHours(optimalHour, 0, 0, 0)
  } else {
    // Send tomorrow at optimal hour
    scheduledTime.setDate(scheduledTime.getDate() + 1)
    scheduledTime.setHours(optimalHour, 0, 0, 0)
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

        // Determine optimal send time (always use optimizer)
        const scheduledFor = await calculateOptimalSendTime(userId, profile)

        // Extract demographics for tracking
        const demographics = profile.demographics as any
        const sensitiveData = profile.sensitiveData as any
        
        let userAgeBracket: string | undefined
        let userIncomeBracket: string | undefined
        let userIndustry: string | undefined
        
        // Age bracket
        if (demographics?.ageRange) {
          userAgeBracket = demographics.ageRange
        } else if (sensitiveData?.age) {
          const age = sensitiveData.age
          if (age < 25) userAgeBracket = '<25'
          else if (age < 35) userAgeBracket = '25-34'
          else if (age < 45) userAgeBracket = '35-44'
          else if (age < 55) userAgeBracket = '45-54'
          else userAgeBracket = '55+'
        }
        
        // Income bracket
        if (sensitiveData?.income) {
          const income = sensitiveData.income
          if (income.includes('<')) userIncomeBracket = '<$50K'
          else if (income.includes('50') && income.includes('75')) userIncomeBracket = '$50K-$75K'
          else if (income.includes('75') && income.includes('100')) userIncomeBracket = '$75K-$100K'
          else if (income.includes('100')) userIncomeBracket = '$100K+'
        }
        
        // Industry
        if (demographics?.industry) {
          userIndustry = demographics.industry
        }

        // Generate transparency explanation
        const transparencyReasons: string[] = []
        
        // Category match
        if (options?.categoryFilter) {
          const interests = profile.interests as any
          const userCategories = interests?.productCategories || []
          if (userCategories.includes(options.categoryFilter)) {
            transparencyReasons.push(`Matches your <strong>${options.categoryFilter}</strong> interests`)
          }
        }
        
        // Demographic match
        if (options?.demographicFilters) {
          const demographics = profile.demographics as any
          if (options.demographicFilters.ageRange && demographics?.ageRange === options.demographicFilters.ageRange) {
            transparencyReasons.push(`Targeted to <strong>${demographics.ageRange}</strong> demographic`)
          }
          if (options.demographicFilters.location && demographics?.location === options.demographicFilters.location) {
            transparencyReasons.push(`Available in <strong>${demographics.location}</strong>`)
          }
        }
        
        // Engagement level
        if (options?.behavioralFilters?.minEngagementScore) {
          const behavioral = profile.behavioral as any
          if (behavioral?.engagementScore) {
            const engagementLevel = behavioral.engagementScore > 0.7 ? 'high' : behavioral.engagementScore > 0.4 ? 'moderate' : 'low'
            transparencyReasons.push(`Based on your <strong>${engagementLevel} engagement</strong> with similar content`)
          }
        }
        
        // Default reason
        if (transparencyReasons.length === 0) {
          transparencyReasons.push('You opted in to receive survey notifications')
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
          
          <!-- Transparency Section (GDPR Article 13) -->
          <div style="margin: 24px 0; padding: 16px; background-color: #dbeafe; border-left: 4px solid #3b82f6; border-radius: 4px;">
            <p style="margin: 0; font-weight: bold; color: #1e40af; font-size: 14px;">💡 Why you're seeing this</p>
            <p style="margin: 8px 0 0 0; color: #1e3a8a; font-size: 13px; line-height: 1.6;">
              ${transparencyReasons.map(reason => `• ${reason}`).join('<br>')}
            </p>
            <p style="margin: 8px 0 0 0; font-size: 12px; color: #1e40af;">
              <a href="${process.env.NEXT_PUBLIC_APP_URL}/transparency" style="color: #1e40af; text-decoration: underline;">Learn how we personalize content</a>
            </p>
          </div>
          
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
          
          // Track email send event for analytics
          try {
            await trackEmailSend({
              userId,
              notificationId,
              emailType: 'survey_notification',
              sentAt: scheduledFor,
              userAgeBracket,
              userIncomeBracket,
              userIndustry,
            })
          } catch (trackError) {
            console.error('[NotifyCampaign] Error tracking email send:', trackError)
            // Don't fail the notification if tracking fails
          }
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
