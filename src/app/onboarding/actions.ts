'use server'

import { auth } from '@/lib/auth/auth.config'
import { getUserProfile, getUserProfileByEmail, createUserProfile, updateDemographics, updateInterests } from '@/db/repositories/userProfileRepository'
import { trackOnboardingComplete } from '@/server/eventTrackingService'

export async function completeOnboarding(data: {
  demographics?: {
    gender?: string
    ageRange?: string
    location?: string
    language?: string
    education?: string
    profession?: string
    fieldOfStudy?: string
    culture?: string
    aspirations?: string[]
  }
  interests?: {
    productCategories?: string[]
    topics?: string[]
  }
  sensitiveData?: {
    incomeRange?: string
    purchaseHistory?: {
      amazonCategories?: string[]
      frequency?: string
    }
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

    // Get or create user profile - check by email FIRST (matches unique constraint)
    console.log('[completeOnboarding] Fetching profile by email:', email)
    let profile = await getUserProfileByEmail(email)
    
    if (!profile) {
      // Double-check by userId
      console.log('[completeOnboarding] Profile not found by email, checking by userId:', userId)
      profile = await getUserProfile(userId)
    }
    
    if (!profile) {
      console.log('[completeOnboarding] Profile not found, creating new one')
      try {
        profile = await createUserProfile({ id: userId, email })
      } catch (createError: any) {
        // Handle duplicate key constraint violations (race condition)
        if (createError?.code === '23505' || 
            createError?.message?.includes('duplicate key') || 
            createError?.message?.includes('unique constraint')) {
          console.log('[completeOnboarding] Duplicate key during create, fetching existing profile')
          // Profile was created by another request, fetch it
          profile = await getUserProfileByEmail(email)
          if (!profile) {
            profile = await getUserProfile(userId)
          }
          if (!profile) {
            console.error('[completeOnboarding] Still no profile after duplicate key error')
            throw new Error('Failed to create or retrieve user profile')
          }
        } else {
          // Re-throw other errors
          throw createError
        }
      }
    }
    console.log('[completeOnboarding] Profile exists:', profile.id)

    // Update demographics if provided
    if (data.demographics) {
      console.log('[completeOnboarding] Updating demographics:', JSON.stringify(data.demographics))
      await updateDemographics(profile.id, data.demographics)
    }

    // Update interests if provided
    if (data.interests) {
      console.log('[completeOnboarding] Updating interests:', JSON.stringify(data.interests))
      await updateInterests(profile.id, data.interests)
    }

    // Update sensitive data if provided (privacy-protected)
    if (data.sensitiveData) {
      console.log('[completeOnboarding] Updating sensitive data (encrypted)')
      const { db } = await import('@/db')
      const { userProfiles } = await import('@/db/schema')
      const { eq } = await import('drizzle-orm')
      
      await db
        .update(userProfiles)
        .set({
          sensitiveData: data.sensitiveData,
          updatedAt: new Date()
        })
        .where(eq(userProfiles.id, profile.id))
    }

    // Mark onboarding as complete
    console.log('[completeOnboarding] Marking onboarding as complete')
    const { db } = await import('@/db')
    const { userProfiles } = await import('@/db/schema')
    const { eq } = await import('drizzle-orm')
    
    await db
      .update(userProfiles)
      .set({
        onboardingComplete: true,
        updatedAt: new Date()
      })
      .where(eq(userProfiles.id, profile.id))

    // Track onboarding completion
    console.log('[completeOnboarding] Tracking completion event')
    await trackOnboardingComplete(profile.id, data.demographics, data.interests).catch((err) => {
      console.error('[completeOnboarding] Tracking error (non-fatal):', err)
    })

    console.log('[completeOnboarding] Success!')
    return { success: true }
  } catch (error) {
    console.error('[completeOnboarding] Error:', error)
    throw error
  }
}
