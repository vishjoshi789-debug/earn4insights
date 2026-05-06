import { db } from '@/db'
import { userProfiles } from '@/db/schema'
import { eq } from 'drizzle-orm'
import {
  getUserProfile,
  getUserProfileByEmail,
  createUserProfile,
  DEFAULT_NOTIFICATION_PREFS,
  DEFAULT_CONSENT,
} from '@/db/repositories/userProfileRepository'

/**
 * Ensures a user profile exists for the given user, with id matching the
 * session userId. Reconciles legacy id mismatches by replacing orphan
 * profiles whose email matches but whose id does not.
 *
 * @param userId - The user's ID (from the auth session — this is canonical)
 * @param email - The user's email
 * @returns The user profile (existing, reconciled, or newly created)
 */
export async function ensureUserProfile(userId: string, email: string) {
  // Check by email first (unique constraint is on email)
  let profile = await getUserProfileByEmail(email)

  if (profile) {
    if (profile.id === userId) {
      // Happy path — the profile is correctly keyed
      return profile
    }

    // ID MISMATCH — orphan profile reconciliation.
    //
    // The profile exists for this email but with a different id than the
    // current session. This happens when:
    //   - An older signup created a profile, the user was deleted from
    //     `users`, and a new signup created a different users.id with the
    //     same email. The old user_profiles row is now orphaned because
    //     no users row matches its id.
    //   - Auth migrations changed the id generation format.
    //
    // The session's userId is canonical (it's what the user is currently
    // logged in as, and it MUST exist in `users` for auth to have worked).
    // We resolve the mismatch by deleting the orphan and creating a fresh
    // profile keyed by the session userId. All FKs from other tables to
    // user_profiles.id use ON DELETE CASCADE (migration 003), so any
    // dependent rows referencing the orphan id get cleaned up automatically.
    // Those dependent rows were already inaccessible (orphaned alongside
    // the profile), so nothing reachable is lost.
    console.warn(
      `[ensureUserProfile] ID mismatch — orphan profile.id=${profile.id} ` +
      `for email=${email}, session userId=${userId}. Reconciling…`
    )

    await db.transaction(async (tx) => {
      await tx.delete(userProfiles).where(eq(userProfiles.id, profile!.id))
      await tx.insert(userProfiles).values({
        id: userId,
        email,
        demographics: null,
        interests: null,
        behavioral: null,
        sensitiveData: null,
        notificationPreferences: DEFAULT_NOTIFICATION_PREFS,
        consent: DEFAULT_CONSENT,
      })
    })

    const reconciled = await getUserProfile(userId)
    if (!reconciled) {
      throw new Error(
        `Profile reconciliation failed: could not fetch new profile after replace for ${email}`
      )
    }
    console.log(`[ensureUserProfile] Reconciled profile id=${userId} for email=${email}`)
    return reconciled
  }

  // No row by email — try by userId (covers race conditions)
  profile = await getUserProfile(userId)

  if (!profile) {
    console.log(`[ensureUserProfile] Creating new profile for user: ${userId}, email: ${email}`)
    try {
      profile = await createUserProfile({
        id: userId,
        email: email,
        demographics: null,
        interests: null
      })
    } catch (error: any) {
      // Handle duplicate-key race: another request created the profile
      // between our email check and our insert.
      if (error?.code === '23505' ||
          error?.message?.includes('duplicate key') ||
          error?.message?.includes('unique constraint')) {
        console.log(`[ensureUserProfile] Profile already exists (duplicate key), fetching by email`)
        profile = await getUserProfileByEmail(email)

        if (!profile) {
          console.error(`[ensureUserProfile] Failed to fetch profile after duplicate key error for email: ${email}`)
          throw new Error('Failed to create or retrieve user profile')
        }

        // Even in the race-recovery path, check id alignment. If the
        // racing request created the profile with a different id (e.g.
        // because it ran with a stale JWT), recurse to reconcile.
        if (profile.id !== userId) {
          return ensureUserProfile(userId, email)
        }
      } else {
        throw error
      }
    }
  }

  return profile
}

/**
 * Checks if a user has completed onboarding.
 * A user is considered to have completed onboarding if they have:
 * - The onboardingComplete flag set to true, OR
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
  
  // First check the explicit onboardingComplete flag
  if (profile.onboardingComplete) {
    return true
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
