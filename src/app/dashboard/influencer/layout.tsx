import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth/auth.config'

/**
 * ER.1 — Server-side guard for the influencer surface.
 *
 * Allowed:
 *   - role === 'influencer'           (primary-role influencer)
 *   - users.is_influencer === true    (dual-role consumer-with-isInfluencer)
 *   - role === 'admin'                (support / debug bypass — standard)
 *
 * Denied:
 *   - everyone else → redirect to /dashboard?upgrade=influencer where
 *     the UpgradePromptCard renders the "Become an influencer" CTA.
 *
 * Lives at /dashboard/influencer/layout.tsx so it wraps EVERY
 * /dashboard/influencer/* page automatically — no per-page guard to
 * forget. Runs as a server component, so the redirect fires before any
 * client paint (no content flash like the old client-side check in
 * /dashboard/brand/campaigns/page.tsx).
 *
 * /dashboard/layout.tsx's OnboardingGuard runs FIRST (composes outside),
 * so by the time this layout executes the user already has a session.
 * We still null-check defensively in case the auth gap is ever closed.
 */
export default async function InfluencerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session?.user) {
    redirect('/login?callbackUrl=/dashboard')
  }
  const role = (session.user as { role?: string }).role
  const isInfluencer = (session.user as { isInfluencer?: boolean }).isInfluencer === true

  if (role === 'admin') return <>{children}</>
  if (role === 'influencer' || isInfluencer) return <>{children}</>

  redirect('/dashboard?upgrade=influencer')
}
