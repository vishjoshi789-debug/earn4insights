import { EnsureProfile } from '@/components/OnboardingGuard'

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return <EnsureProfile>{children}</EnsureProfile>
}
