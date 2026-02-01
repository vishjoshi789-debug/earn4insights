import { getUserProfile, getUserProfileByEmail, createUserProfile } from '@/db/repositories/userProfileRepository'

/**
 * Ensures a user profile exists for the given user.
 * Creates one with defaults if it doesn't exist.
 * 
 * @param userId - The user's ID
 * @param email - The user's email
 * @returns The user profile (existing or newly created)
 */
export async function ensureUserProfile(userId: string, email: string) {
  // Check if profile already exists by email first (unique constraint is on email)
  let profile = await getUserProfileByEmail(email)
  
  // If found by email but different userId, return existing profile
  if (profile) {
    console.log(`[ensureUserProfile] Profile already exists for email: ${email}`)
    return profile
  }
  
  // Double-check by userId
  profile = await getUserProfile(userId)
  
  if (!profile) {
    // Create new profile with default settings
    console.log(`[ensureUserProfile] Creating new profile for user: ${userId}, email: ${email}`)
    try {
      profile = await createUserProfile({
        id: userId,
        email: email,
        demographics: null,
        interests: null
      })
    } catch (error: any) {
      // Handle duplicate key constraint violations
      if (error?.code === '23505' || 
          error?.message?.includes('duplicate key') || 
          error?.message?.includes('unique constraint')) {
        console.log(`[ensureUserProfile] Profile already exists (duplicate key), fetching by email`)
        // Race condition: profile was created between check and insert
        // Fetch the profile by email
        profile = await getUserProfileByEmail(email)
        
        if (!profile) {
          // If still not found, something is wrong
          console.error(`[ensureUserProfile] Failed to fetch profile after duplicate key error for email: ${email}`)
          throw new Error('Failed to create or retrieve user profile')
        }
      } else {
        // Re-throw other errors
        throw error
      }
    }
  }
  
  return profile
}

/**
 * Checks if a user has completed onboarding.
 * A user is considered to have completed onboarding if they have:
 * - At least one demographic field filled, OR
 * - At least one interest selected
 * 
 * @param userId - The user's ID
 * @returns true if onboarding is complete, false otherwise
 */
export async function hasCompletedOnboarding(userId: string): Promise<boolean> {
  const profile = await getUserProfile(userId)
  
  if (!profile) {
    return false
  }
  
  const demographics = profile.demographics as any
  const interests = profile.interests as any
  
  // Check if any demographic field is filled
  const hasDemographics = demographics && (
    demographics.gender ||
    demographics.ageRange ||
    demographics.location ||
    demographics.education
  )
  
  // Check if any interests are selected
  const hasInterests = interests && 
    interests.productCategories && 
    interests.productCategories.length > 0
  
  // User has completed onboarding if they have either demographics OR interests
  return !!(hasDemographics || hasInterests)
}

/**
 * Get the onboarding status with detailed information
 */
export async function getOnboardingStatus(userId: string) {
  const profile = await getUserProfile(userId)
  
  if (!profile) {
    return {
      hasProfile: false,
      hasCompletedOnboarding: false,
      hasDemographics: false,
      hasInterests: false
    }
  }
  
  const demographics = profile.demographics as any
  const interests = profile.interests as any
  
  const hasDemographics = !!(demographics && (
    demographics.gender ||
    demographics.ageRange ||
    demographics.location ||
    demographics.education
  ))
  
  const hasInterests = !!(interests && 
    interests.productCategories && 
    interests.productCategories.length > 0)
  
  return {
    hasProfile: true,
    hasCompletedOnboarding: hasDemographics || hasInterests,
    hasDemographics,
    hasInterests
  }
}
