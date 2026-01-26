import { EnsureProfile } from '@/components/OnboardingGuard'
import OnboardingClient from './OnboardingClient'

export default function OnboardingPage() {
  return (
    <EnsureProfile>
      <OnboardingClient />
    </EnsureProfile>
  )
}
