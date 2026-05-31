import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth/auth.config'
import { ensureUserProfile, hasCompletedOnboarding } from '@/lib/auth/ensureUserProfile'
import { hasCompletedBrandOnboarding } from '@/db/repositories/brandProfileRepository'

/**
 * Wrapper component that ensures user has a profile and has completed onboarding.
 *
 * Role behaviour:
 *   - consumer → must complete consumer onboarding (user_profiles.onboardingComplete)
 *   - brand    → must complete brand onboarding (brand_profiles.onboarding_completed)
 *   - admin    → no onboarding required
 *
 * If onboarding isn't complete, redirects to /onboarding (which itself
 * routes the user to the correct wizard based on role).
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

  const role = session.user.role as string
  const userId = session.user.id

  // Admin — no onboarding gate.
  if (role === 'admin') {
    return <>{children}</>
  }

  // Brand path — gate on brand_profiles.onboarding_completed.
  // We don't call ensureUserProfile here because brand_profiles is
  // a separate table; ensureUserProfile is consumer-flavoured (it
  // creates user_profiles rows with consumer-shaped JSONB).
  if (role === 'brand') {
    if (skipOnboarding) return <>{children}</>
    const done = await hasCompletedBrandOnboarding(userId)
    console.log(
      `[OnboardingGuard] email=${session.user.email} role=brand done=${done} ` +
      `result=${done ? 'passed' : 'REDIRECT'}`,
    )
    if (!done) redirect('/onboarding')
    return <>{children}</>
  }

  // Consumer path — original behaviour.
  // Ensure user profile exists (create if needed).
  const profile = await ensureUserProfile(userId, session.user.email)

  if (!skipOnboarding) {
    const onboardingComplete = await hasCompletedOnboarding(profile.id)

    // Diagnostic — grep Vercel logs for "[OnboardingGuard]" to trace.
    console.log(
      `[OnboardingGuard] email=${session.user.email} ` +
      `role=${role} ` +
      `profileId=${profile.id} ` +
      `sessionId=${userId} ` +
      `flag=${profile.onboardingComplete} ` +
      `hasDemo=${!!profile.demographics} ` +
      `hasInterests=${!!profile.interests} ` +
      `result=${onboardingComplete ? 'passed' : 'REDIRECT'}`,
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

