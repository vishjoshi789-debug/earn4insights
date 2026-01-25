'use server'

import { auth } from '@/lib/auth/auth.config'
import { trackSurveyStart, trackSurveyComplete } from '@/server/eventTrackingService'
import { getUserProfile, createUserProfile } from '@/db/repositories/userProfileRepository'

export async function trackSurveyStartAction(surveyId: string) {
  try {
    const session = await auth()
    if (!session?.user?.id) return
    
    let profile = await getUserProfile(session.user.id)
    if (!profile && session.user.email) {
      profile = await createUserProfile({ 
        id: session.user.id, 
        email: session.user.email 
      })
    }
    if (!profile) return
    
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
    
    let profile = await getUserProfile(session.user.id)
    if (!profile && session.user.email) {
      profile = await createUserProfile({ 
        id: session.user.id, 
        email: session.user.email 
      })
    }
    if (!profile) return
    
    const sessionId = `${session.user.id}-${Date.now()}`
    
    await trackSurveyComplete(session.user.id, surveyId, sessionId)
  } catch (error) {
    console.error('Failed to track survey complete:', error)
  }
}
