import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth/auth.config'

/**
 * ER.1 — Server-side guard for the brand surface.
 *
 * Allowed:
 *   - role === 'brand'                (primary-role brand)
 *   - users.is_brand === true         (dual-role brand-with-something-else
 *                                      — rare in v1 but supported)
 *   - role === 'admin'                (support / debug bypass — standard)
 *
 * Denied:
 *   - everyone else → redirect to /dashboard?upgrade=brand where the
 *     UpgradePromptCard renders the restricted-access copy. Unlike the
 *     influencer flow, there is NO auto-upgrade path — brand accounts
 *     require business verification + billing setup, so the CTA is a
 *     "contact us" link rather than a one-click upgrade.
 *
 * Lives at /dashboard/brand/layout.tsx so it wraps every
 * /dashboard/brand/* page automatically. Replaces the inconsistent
 * client-side `router.push('/dashboard')` in /dashboard/brand/campaigns/
 * page.tsx (which only protected that one page and flashed content
 * before redirecting).
 */
export default async function BrandLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session?.user) {
    redirect('/login?callbackUrl=/dashboard')
  }
  const role = (session.user as { role?: string }).role
  const isBrand = (session.user as { isBrand?: boolean }).isBrand === true

  if (role === 'admin') return <>{children}</>
  if (role === 'brand' || isBrand) return <>{children}</>

  redirect('/dashboard?upgrade=brand')
}
