'use server'

import { auth } from '@/lib/auth/auth.config'
import { trackProductView, trackSurveyStart, trackSurveyComplete } from '@/server/eventTrackingService'
import { ensureUserProfile } from '@/lib/auth/ensureUserProfile'
import { getOrCreateSessionId } from '@/lib/sessionManager'
import { getProductById } from '@/db/repositories/productRepository'

export async function trackProductViewAction(productId: string) {
  try {
    const session = await auth()
    if (!session?.user?.id) return { success: false } // Don't track anonymous users
    
    // Ensure user profile exists
    await ensureUserProfile(session.user.id, session.user.email!)
    
    // Get session ID
    const sessionId = await getOrCreateSessionId()
    
    // Get product details for metadata enrichment
    const product = await getProductById(productId)
    const category = product?.profile?.data?.category
    
    await trackProductView(session.user.id, productId, sessionId, category)
    return { success: true }
  } catch (error) {
    console.error('Failed to track product view:', error)
    return { success: false }
  }
}

export async function trackSurveyStartAction(surveyId: string) {
  try {
    const session = await auth()
    if (!session?.user?.id) return { success: false }
    
    await ensureUserProfile(session.user.id, session.user.email!)
    const sessionId = await getOrCreateSessionId()
    
    await trackSurveyStart(session.user.id, surveyId, sessionId)
    return { success: true }
  } catch (error) {
    console.error('Failed to track survey start:', error)
    return { success: false }
  }
}

export async function trackSurveyCompleteAction(surveyId: string) {
  try {
    const session = await auth()
    if (!session?.user?.id) return { success: false }
    
    await ensureUserProfile(session.user.id, session.user.email!)
    const sessionId = await getOrCreateSessionId()
    
    await trackSurveyComplete(session.user.id, surveyId, sessionId)
    return { success: true }
  } catch (error) {
    console.error('Failed to track survey complete:', error)
    return { success: false }
  }
}
