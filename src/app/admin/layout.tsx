import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'

import DashboardShell from '@/app/dashboard/DashboardShell'
import { auth } from '@/lib/auth/auth.config'
import { ChatWidget } from '@/components/support/ChatWidget'
import { ActiveViewProvider } from '@/components/ActiveViewProvider'
import { EmailVerificationProvider } from '@/components/EmailVerificationProvider'

/**
 * Admin layout — restores the sidebar + header on every /admin/* page.
 *
 * Before this file existed, /admin/* fell back to the root layout only
 * (which has no sidebar). Admins landing on /admin/platform-analytics
 * had no way to navigate to other admin tools without typing URLs.
 *
 * Design — mirrors /dashboard/layout.tsx with three deliberate trims:
 *   - No OnboardingGuard. Admin bypasses it anyway; we enforce auth +
 *     role here directly.
 *   - No EmailVerificationBanner mount. Admin role doesn't hit any of
 *     the 8 hard-blocked routes that the banner nudges users toward.
 *     The EmailVerificationProvider is still mounted because
 *     DashboardShell's sidebar-lock filter reads its `isVerified` —
 *     the provider's fail-open default means admin's sidebar never
 *     shows 🔒 locks even on requiresEmailVerified items.
 *   - No ConsentRenewalWrapper. That's a consumer-facing GDPR prompt;
 *     admins don't see consumer consent flows.
 *
 * Role gate: redirects non-admin authenticated users to /dashboard
 * (where the admin landing-page redirect in dashboard/page.tsx would
 * otherwise send them back here in a loop — but they're not admin,
 * so the dashboard renders the appropriate role view instead).
 * Logged-out visitors redirect to /login with a callbackUrl.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await auth()
  if (!session?.user) {
    redirect('/login?callbackUrl=/admin/platform-analytics')
  }
  const role = (session.user as { role?: string }).role
  if (role !== 'admin') {
    redirect('/dashboard')
  }

  return (
    <ActiveViewProvider defaultView="admin">
      <EmailVerificationProvider>
        <DashboardShell>{children}</DashboardShell>
        <ChatWidget />
      </EmailVerificationProvider>
    </ActiveViewProvider>
  )
}
