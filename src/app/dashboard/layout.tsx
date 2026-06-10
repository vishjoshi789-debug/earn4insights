import type { ReactNode } from 'react'
import DashboardShell from './DashboardShell'
import { OnboardingGuard } from '@/components/OnboardingGuard'
import { auth } from '@/lib/auth/auth.config'
import { getUserProfile, getUserProfileByEmail } from '@/db/repositories/userProfileRepository'
import { ConsentRenewalWrapper } from '@/components/ConsentRenewalWrapper'
import { ChatWidget } from '@/components/support/ChatWidget'
import { ActiveViewProvider } from '@/components/ActiveViewProvider'
import { EmailVerificationBanner } from '@/components/EmailVerificationBanner'
import { EmailNotVerifiedModal } from '@/components/EmailNotVerifiedModal'

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

  // 3.5E — default view is the session role. ActiveViewProvider
  // overrides this from sessionStorage AFTER mount for dual-role
  // users who toggled via the RoleSwitcher.
  const defaultView =
    (session?.user?.role as 'brand' | 'consumer' | 'influencer' | 'admin' | undefined) ?? 'consumer'

  return (
    <OnboardingGuard>
      <ActiveViewProvider defaultView={defaultView}>
        {profile && <ConsentRenewalWrapper profile={profile} userRole={session?.user?.role} />}
        {/* EV.2.2 — soft prompt at the top of every dashboard page when
            email isn't verified yet. Hides itself once verified or
            session-dismissed. The matching modal below intercepts 403
            EMAIL_NOT_VERIFIED responses from hard-blocked routes. */}
        <div className="px-4 pt-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full empty:hidden">
          <EmailVerificationBanner />
        </div>
        <DashboardShell>{children}</DashboardShell>
        <EmailNotVerifiedModal />
        <ChatWidget />
      </ActiveViewProvider>
    </OnboardingGuard>
  )
}
