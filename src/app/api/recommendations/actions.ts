'use server'

import { auth } from '@/lib/auth/auth.config'
import { ensureUserProfile } from '@/lib/auth/ensureUserProfile'
import { 
  getPersonalizedRecommendations, 
  explainRecommendation,
  getRecommendedSurveys 
} from '@/server/personalizationEngine'
import { 
  calculateUserEngagement,
  calculateCategoryInterests,
  calculateSurveyCompletionRate 
} from '@/server/analyticsService'

/**
 * Get personalized product recommendations
 */
export async function getRecommendations(limit: number = 10) {
  try {
    const session = await auth()
    if (!session?.user?.id || !session?.user?.email) {
      return { success: false, error: 'Unauthorized' }
    }

    await ensureUserProfile(session.user.id, session.user.email)
    const recommendations = await getPersonalizedRecommendations(session.user.id, limit)
    
    return { success: true, recommendations }
  } catch (error) {
    console.error('Error getting recommendations:', error)
    return { success: false, error: String(error) }
  }
}

/**
 * Get explanation for why a product is recommended
 */
export async function getRecommendationExplanation(productId: string) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, error: 'Unauthorized' }
    }

    const explanation = await explainRecommendation(session.user.id, productId)
    return { success: true, ...explanation }
  } catch (error) {
    console.error('Error getting recommendation explanation:', error)
    return { success: false, error: String(error) }
  }
}

/**
 * Get user's analytics dashboard data
 */
export async function getUserAnalytics() {
  try {
    const session = await auth()
    if (!session?.user?.id || !session?.user?.email) {
      return { success: false, error: 'Unauthorized' }
    }

    await ensureUserProfile(session.user.id, session.user.email)

    const [
      engagementScore,
      categoryInterests,
      completionRate,
      recommendedSurveys
    ] = await Promise.all([
      calculateUserEngagement(session.user.id),
      calculateCategoryInterests(session.user.id),
      calculateSurveyCompletionRate(session.user.id),
      getRecommendedSurveys(session.user.id, 5)
    ])

    return {
      success: true,
      analytics: {
        engagementScore,
        categoryInterests,
        surveyCompletionRate: completionRate,
        recommendedSurveys
      }
    }
  } catch (error) {
    console.error('Error getting user analytics:', error)
    return { success: false, error: String(error) }
  }
}
