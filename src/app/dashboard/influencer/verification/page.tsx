import { auth } from '@/lib/auth/auth.config'
import { redirect } from 'next/navigation'
import { VerificationClient } from './VerificationClient'

/**
 * A9.2 — Influencer verification page.
 *
 * Server stub — auth + role gate, then hands off to the client component
 * which lives-polls `/api/influencer/verification/status` for the live
 * checklist + current request state.
 *
 * Role gate mirrors `/dashboard/influencer/layout.tsx` (ER.1) but adds
 * an explicit message on bounce instead of the upgrade card.
 */
export default async function InfluencerVerificationPage() {
  const session = await auth()
  if (!session?.user?.email) {
    redirect('/login?callbackUrl=/dashboard/influencer/verification')
  }
  const role = (session.user as { role?: string }).role
  const isInfluencer = (session.user as { isInfluencer?: boolean }).isInfluencer === true
  if (role !== 'admin' && role !== 'influencer' && !isInfluencer) {
    redirect('/dashboard?upgrade=influencer')
  }

  return <VerificationClient />
}
