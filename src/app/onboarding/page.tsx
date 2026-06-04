import { auth } from '@/lib/auth/auth.config'
import { redirect } from 'next/navigation'
import { EnsureProfile } from '@/components/OnboardingGuard'
import OnboardingClient from './OnboardingClient'
import BrandOnboardingClient from './BrandOnboardingClient'
import InfluencerOnboardingClient from './InfluencerOnboardingClient'
import { getBrandProfile } from '@/db/repositories/brandProfileRepository'
import { getProfileByUserId as getInfluencerProfileByUserId } from '@/db/repositories/influencerProfileRepository'

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ path?: string }>
}) {
  const session = await auth()

  if (!session?.user?.id) {
    redirect('/api/auth/signin')
  }

  const role = session.user.role
  // 3.5F — cross-role upgrade override. Settings page links to
  // /onboarding?path=influencer; this lets a consumer (or any
  // non-influencer role) explicitly enter the influencer wizard.
  // Without this override the consumer would hit their default
  // consumer onboarding flow.
  const params = await searchParams
  const explicitPath = params.path === 'influencer' ? 'influencer' : null

  // Brand path — hydrate any saved partial state, then render the
  // brand wizard. If the brand already completed onboarding, bounce
  // to dashboard so they don't accidentally re-open the wizard.
  // Brand role overrides any ?path query (we never put a brand into
  // the influencer wizard implicitly).
  if (role === 'brand') {
    const existing = await getBrandProfile(session.user.id)
    if (existing?.onboardingCompleted) {
      redirect('/dashboard')
    }
    return (
      <BrandOnboardingClient
        initial={existing ?? null}
        userName={session.user.name ?? null}
      />
    )
  }

  // Influencer path — either:
  //   (a) user's primary role IS 'influencer' (post-3.5B signup), or
  //   (b) explicit ?path=influencer override from 3.5F cross-role upgrade
  //
  // For (b) the user keeps their existing primary role (e.g. consumer)
  // and the wizard's completion action sets users.is_influencer=true
  // without touching users.role. The crossRoleUpgrade prop tells the
  // wizard's done screen to force a sign-out (the JWT carries stale
  // capability flags until the next login mints a fresh one — same
  // pattern as 2FA setup).
  if ((role as string) === 'influencer' || explicitPath === 'influencer') {
    const existing = await getInfluencerProfileByUserId(session.user.id)
    if (existing?.onboardingCompleted) {
      redirect('/dashboard')
    }
    const isCrossRoleUpgrade = (role as string) !== 'influencer'
    return (
      <InfluencerOnboardingClient
        userId={session.user.id}
        initial={existing ?? null}
        userName={session.user.name ?? null}
        isCrossRoleUpgrade={isCrossRoleUpgrade}
      />
    )
  }

  // Admins have no consumer onboarding — send them straight to dashboard.
  if ((role as string) === 'admin') {
    redirect('/dashboard')
  }

  // Consumer (default) path — existing wizard unchanged.
  return (
    <EnsureProfile>
      <OnboardingClient userRole={role || 'consumer'} />
    </EnsureProfile>
  )
}
