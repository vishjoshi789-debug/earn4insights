'use server'

import { auth } from '@/lib/auth/auth.config'
import { getUserProfile, createUserProfile, updateDemographics, updateInterests } from '@/db/repositories/userProfileRepository'
import { trackOnboardingComplete } from '@/server/eventTrackingService'

export async function completeOnboarding(data: {
  demographics?: {
    gender?: string
    ageRange?: string
    location?: string
    language?: string
    education?: string
  }
  interests?: {
    productCategories?: string[]
    topics?: string[]
  }
}) {
  try {
    console.log('[completeOnboarding] Starting with data:', JSON.stringify(data))
    
    const session = await auth()
    console.log('[completeOnboarding] Session:', session?.user?.id, session?.user?.email)
    
    if (!session?.user?.id || !session?.user?.email) {
      console.error('[completeOnboarding] No session found')
      throw new Error('Unauthorized')
    }

    const userId = session.user.id
    const email = session.user.email

    // Get or create user profile
    console.log('[completeOnboarding] Fetching profile for user:', userId)
    let profile = await getUserProfile(userId)
    
    if (!profile) {
      console.log('[completeOnboarding] Profile not found, creating new one')
      profile = await createUserProfile({ id: userId, email })
    }
    console.log('[completeOnboarding] Profile exists:', profile.id)

    // Update demographics if provided
    if (data.demographics) {
      console.log('[completeOnboarding] Updating demographics:', JSON.stringify(data.demographics))
      await updateDemographics(userId, data.demographics)
    }

    // Update interests if provided
    if (data.interests) {
      console.log('[completeOnboarding] Updating interests:', JSON.stringify(data.interests))
      await updateInterests(userId, data.interests)
    }

    // Track onboarding completion
    console.log('[completeOnboarding] Tracking completion event')
    await trackOnboardingComplete(userId, data.demographics, data.interests).catch((err) => {
      console.error('[completeOnboarding] Tracking error (non-fatal):', err)
    })

    console.log('[completeOnboarding] Success!')
    return { success: true }
  } catch (error) {
    console.error('[completeOnboarding] Error:', error)
    throw error
  }
}
