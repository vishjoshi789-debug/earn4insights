'use server'

import { auth } from '@/lib/auth/auth.config'
import { getUserProfile, createUserProfile, updateDemographics, updateInterests } from '@/db/repositories/userProfileRepository'

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
  const session = await auth()
  if (!session?.user?.id || !session?.user?.email) {
    throw new Error('Unauthorized')
  }

  const userId = session.user.id
  const email = session.user.email

  // Get or create user profile
  let profile = await getUserProfile(userId)
  if (!profile) {
    profile = await createUserProfile({ id: userId, email })
  }

  // Update demographics if provided
  if (data.demographics) {
    await updateDemographics(userId, data.demographics)
  }

  // Update interests if provided
  if (data.interests) {
    await updateInterests(userId, data.interests)
  }

  return { success: true }
}
