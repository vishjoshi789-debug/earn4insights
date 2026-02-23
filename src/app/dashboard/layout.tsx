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
  let profile = null
  
  if (session?.user?.id) {
    profile = await getUserProfile(session.user.id)
    // Fallback: profile may have been created with a different ID (e.g. different auth provider)
    if (!profile && session?.user?.email) {
      profile = await getUserProfileByEmail(session.user.email)
    }
  }

  return (
    <OnboardingGuard>
      {profile && <ConsentRenewalWrapper profile={profile} />}
      <DashboardShell>{children}</DashboardShell>
    </OnboardingGuard>
  )
}
