import type { ReactNode } from 'react'
import DashboardShell from './DashboardShell'
import { OnboardingGuard } from '@/components/OnboardingGuard'

export default function DashboardLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <OnboardingGuard>
      <DashboardShell>{children}</DashboardShell>
    </OnboardingGuard>
  )
}
