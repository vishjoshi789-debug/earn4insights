import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth/auth.config'
import { ensureUserProfile, hasCompletedOnboarding } from '@/lib/auth/ensureUserProfile'

/**
 * Wrapper component that ensures user has a profile and has completed onboarding.
 * 
 * Usage: Wrap this around pages that require onboarding to be complete.
 * 
 * @param skipOnboarding - If true, creates profile but doesn't check onboarding status
 * @param children - Child components to render
 */
export async function OnboardingGuard({ 
  children,
  skipOnboarding = false
}: { 
  children: React.ReactNode
  skipOnboarding?: boolean
}) {
  const session = await auth()
  
  if (!session?.user?.id || !session?.user?.email) {
    redirect('/api/auth/signin')
  }
  
  // Ensure user profile exists (create if needed)
  const profile = await ensureUserProfile(session.user.id, session.user.email)
  
  // Check if onboarding is complete (unless skipped)
  // Use the profile directly rather than re-fetching by userId,
  // because the profile.id may differ from session.user.id
  // (e.g. profile was created under a different auth provider)
  if (!skipOnboarding) {
    const onboardingComplete = await hasCompletedOnboarding(profile.id)
    
    if (!onboardingComplete) {
      redirect('/onboarding')
    }
  }
  
  return <>{children}</>
}

/**
 * Ensures user profile exists without checking onboarding status.
 * Use this for pages like /onboarding and /settings where we need a profile
 * but don't want to redirect users away.
 */
export async function EnsureProfile({ children }: { children: React.ReactNode }) {
  return <OnboardingGuard skipOnboarding={true}>{children}</OnboardingGuard>
}

