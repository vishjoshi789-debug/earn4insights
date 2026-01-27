'use server'

import { auth } from '@/lib/auth/auth.config'
import { ensureUserProfile } from '@/lib/auth/ensureUserProfile'
import { trackCommunityFeatureView } from '@/server/eventTrackingService'

export async function trackCommunityFeatureAction(feature: string) {
  try {
    const session = await auth()
    if (!session?.user?.id || !session?.user?.email) {
      return { success: false }
    }

    await ensureUserProfile(session.user.id, session.user.email)
    await trackCommunityFeatureView(session.user.id, feature)
    
    return { success: true }
  } catch (error) {
    console.error('Error tracking community feature:', error)
    return { success: false }
  }
}
