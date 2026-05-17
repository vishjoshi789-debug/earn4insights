import { EnsureProfile } from '@/components/OnboardingGuard'
import { ChatWidget } from '@/components/support/ChatWidget'

/**
 * Onboarding layout — wraps the onboarding flow with EnsureProfile
 * (creates user_profiles row if missing) and mounts the support
 * ChatWidget. The widget is mounted here intentionally: users who
 * are stuck or confused mid-onboarding are exactly the ones who
 * need help most, and the dashboard layout's widget is unreachable
 * until they finish onboarding.
 */
export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <EnsureProfile>
      {children}
      <ChatWidget />
    </EnsureProfile>
  )
}
