import { auth } from '@/lib/auth/auth.config'
import { redirect } from 'next/navigation'
import { EnsureProfile } from '@/components/OnboardingGuard'
import OnboardingClient from './OnboardingClient'
import BrandOnboardingClient from './BrandOnboardingClient'
import { getBrandProfile } from '@/db/repositories/brandProfileRepository'

export default async function OnboardingPage() {
  const session = await auth()

  if (!session?.user?.id) {
    redirect('/api/auth/signin')
  }

  const role = session.user.role

  // Brand path — hydrate any saved partial state, then render the
  // brand wizard. If the brand already completed onboarding, bounce
  // to dashboard so they don't accidentally re-open the wizard.
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
