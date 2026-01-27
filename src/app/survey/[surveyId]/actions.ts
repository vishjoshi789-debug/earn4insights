'use server'

import { auth } from '@/lib/auth/auth.config'
import { trackSurveyStart, trackSurveyComplete } from '@/server/eventTrackingService'
import { ensureUserProfile } from '@/lib/auth/ensureUserProfile'
import { getOrCreateSessionId } from '@/lib/sessionManager'

export async function trackSurveyStartAction(surveyId: string) {
  try {
    const session = await auth()
    if (!session?.user?.id || !session?.user?.email) return { success: false }
    
    await ensureUserProfile(session.user.id, session.user.email)
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
    if (!session?.user?.id || !session?.user?.email) return { success: false }
    
    await ensureUserProfile(session.user.id, session.user.email)
    const sessionId = await getOrCreateSessionId()
    
    await trackSurveyComplete(session.user.id, surveyId, sessionId)
    return { success: true }
  } catch (error) {
    console.error('Failed to track survey complete:', error)
    return { success: false }
  }
}
