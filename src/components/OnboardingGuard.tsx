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
  
  // Brands and admins don't need consumer onboarding — skip entirely
  const skipForRole = session.user.role === 'brand' || (session.user.role as string) === 'admin'

  // Check if onboarding is complete (unless skipped or brand/admin user)
  // Use the profile directly rather than re-fetching by userId,
  // because the profile.id may differ from session.user.id
  // (e.g. profile was created under a different auth provider)
  if (!skipOnboarding && !skipForRole) {
    const onboardingComplete = await hasCompletedOnboarding(profile.id)

    // Diagnostic logging — helps confirm whether the redirect loop is
    // caused by the flag being false in DB vs. some other issue.
    // Grep Vercel logs for "[OnboardingGuard]" to trace specific accounts.
    console.log(
      `[OnboardingGuard] email=${session.user.email} ` +
      `role=${session.user.role} ` +
      `profileId=${profile.id} ` +
      `sessionId=${session.user.id} ` +
      `flag=${profile.onboardingComplete} ` +
      `hasDemo=${!!profile.demographics} ` +
      `hasInterests=${!!profile.interests} ` +
      `result=${onboardingComplete ? 'passed' : 'REDIRECT'}`
    )

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

