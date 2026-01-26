'use server'

import { auth } from '@/lib/auth/auth.config'
import { trackProductView, trackSurveyStart, trackSurveyComplete } from '@/server/eventTrackingService'
import { ensureUserProfile } from '@/lib/auth/ensureUserProfile'

export async function trackProductViewAction(productId: string) {
  try {
    const session = await auth()
    if (!session?.user?.id) return // Don't track anonymous users
    
    // Ensure user profile exists
    await ensureUserProfile(session.user.id, session.user.email!)
    
    // Generate a session ID (in production, use a proper session management)
    const sessionId = `${session.user.id}-${Date.now()}`
    
    await trackProductView(session.user.id, productId, sessionId)
  } catch (error) {
    console.error('Failed to track product view:', error)
  }
}

export async function trackSurveyStartAction(surveyId: string) {
  try {
    const session = await auth()
    if (!session?.user?.id) return
    
    await ensureUserProfile(session.user.id, session.user.email!)
    const sessionId = `${session.user.id}-${Date.now()}`
    
    await trackSurveyStart(session.user.id, surveyId, sessionId)
  } catch (error) {
    console.error('Failed to track survey start:', error)
  }
}

export async function trackSurveyCompleteAction(surveyId: string) {
  try {
    const session = await auth()
    if (!session?.user?.id) return
    
    await ensureUserProfile(session.user.id, session.user.email!)
    const sessionId = `${session.user.id}-${Date.now()}`
    
    await trackSurveyComplete(session.user.id, surveyId, sessionId)
  } catch (error) {
    console.error('Failed to track survey complete:', error)
  }
}
