import { auth } from '@/lib/auth'
import { getUserProfile } from '@/db/repositories/userProfileRepository'
import { redirect } from 'next/navigation'
import { PrivacySettings } from './PrivacySettings'

export default async function PrivacySettingsPage() {
  const session = await auth()
  
  if (!session?.user?.id) {
    redirect('/api/auth/signin')
  }

  const profile = await getUserProfile(session.user.id)

  // If no profile exists, create one with defaults
  if (!profile) {
    return (
      <div className="container mx-auto py-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold mb-6">Privacy Settings</h1>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-yellow-800">
              Your privacy profile is being set up. Please refresh this page in a moment.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Privacy & Notifications</h1>
        <p className="text-muted-foreground mb-8">
          Control how we use your data and how we communicate with you.
        </p>

        <PrivacySettings userId={session.user.id} initialProfile={profile} />
      </div>
    </div>
  )
}
