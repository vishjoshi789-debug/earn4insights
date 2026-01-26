import { auth } from '@/lib/auth/auth.config'
import { redirect } from 'next/navigation'
import { EnsureProfile } from '@/components/OnboardingGuard'
import OnboardingClient from './OnboardingClient'

export default async function OnboardingPage() {
  const session = await auth()
  
  if (!session?.user?.id) {
    redirect('/api/auth/signin')
  }

  return (
    <EnsureProfile>
      <OnboardingClient userRole={session.user.role || 'brand'} />
    </EnsureProfile>
  )
}
