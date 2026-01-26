'use server'

import { auth } from '@/lib/auth/auth.config'
import { getUserProfile, createUserProfile } from '@/db/repositories/userProfileRepository'
import { redirect } from 'next/navigation'

/**
 * Ensure user has a profile, create one if missing
 * Call this in server components that require user profile
 */
export async function ensureUserProfile() {
  const session = await auth()
  
  if (!session?.user?.id || !session?.user?.email) {
    redirect('/api/auth/signin')
  }

  // Check if profile exists
  let profile = await getUserProfile(session.user.id)

  // Create profile if missing
  if (!profile) {
    console.log(`[Profile] Creating profile for user ${session.user.id}`)
    profile = await createUserProfile({
      id: session.user.id,
      email: session.user.email
    })
  }

  return {
    userId: session.user.id,
    email: session.user.email,
    profile
  }
}
