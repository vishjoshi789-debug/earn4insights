'use server'

import { auth } from '@/lib/auth'
import { trackSurveyStart, trackSurveyComplete } from '@/server/eventTrackingService'
import { getOrCreateUserProfile } from '@/server/userProfileService'

export async function trackSurveyStartAction(surveyId: string) {
  try {
    const session = await auth()
    if (!session?.user?.id) return
    
    await getOrCreateUserProfile(session.user.id, session.user.email!)
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
    
    await getOrCreateUserProfile(session.user.id, session.user.email!)
    const sessionId = `${session.user.id}-${Date.now()}`
    
    await trackSurveyComplete(session.user.id, surveyId, sessionId)
  } catch (error) {
    console.error('Failed to track survey complete:', error)
  }
}
