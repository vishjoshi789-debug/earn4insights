import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth/auth.config'
import { TwoFactorChallenge } from './TwoFactorChallenge'

/**
 * /auth/two-factor — the login 2FA challenge page.
 *
 * Requires a session (the challenge happens after a correct password).
 * Middleware routes users here while their session is in the
 * requires-2FA state; an unauthenticated visitor is sent to /login.
 */
export default async function TwoFactorPage() {
  const session = await auth()
  if (!session?.user?.email) redirect('/login')

  return (
    <div className="flex min-h-[80vh] items-center justify-center p-4">
      <Suspense>
        <TwoFactorChallenge />
      </Suspense>
    </div>
  )
}
