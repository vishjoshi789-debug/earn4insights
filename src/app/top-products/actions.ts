'use server'

import { auth } from '@/lib/auth/auth.config'
import { ensureUserProfile } from '@/lib/auth/ensureUserProfile'
import { trackRankingsView } from '@/server/eventTrackingService'

export async function trackRankingsViewAction(category?: string) {
  try {
    const session = await auth()
    if (!session?.user?.id || !session?.user?.email) {
      return { success: false }
    }

    // Ensure user profile exists
    await ensureUserProfile(session.user.id, session.user.email)

    // Track rankings view
    await trackRankingsView(session.user.id, category)
    
    return { success: true }
  } catch (error) {
    console.error('Error tracking rankings view:', error)
    return { success: false }
  }
}
