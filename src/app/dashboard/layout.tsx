import type { ReactNode } from 'react'
import DashboardShell from './DashboardShell'
import { OnboardingGuard } from '@/components/OnboardingGuard'
import { auth } from '@/lib/auth/auth.config'
import { getUserProfile, getUserProfileByEmail } from '@/db/repositories/userProfileRepository'
import { ConsentRenewalWrapper } from '@/components/ConsentRenewalWrapper'

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode
}) {
  const session = await auth()
  
  // Fetch profile in parallel with onboarding guard logic
  // OnboardingGuard also calls auth() + ensureUserProfile, but brands skip onboarding
  // so we can run profile fetch here and pass it to avoid duplicate DB calls
  let profile = null
  
  if (session?.user?.id) {
    const [profileById, profileByEmail] = await Promise.all([
      getUserProfile(session.user.id),
      session?.user?.email ? getUserProfileByEmail(session.user.email) : Promise.resolve(null),
    ])
    profile = profileById || profileByEmail
  }

  return (
    <OnboardingGuard>
      {profile && <ConsentRenewalWrapper profile={profile} userRole={session?.user?.role} />}
      <DashboardShell>{children}</DashboardShell>
    </OnboardingGuard>
  )
}
