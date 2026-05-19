import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth/auth.config'
import { getDashboardData } from '@/server/platformAnalyticsService'
import PlatformAnalyticsClient from './PlatformAnalyticsClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * /admin/platform-analytics — Founder dashboard
 *
 * Server-rendered shell:
 *   1. Verifies admin role; non-admins redirect to /dashboard.
 *   2. Fetches the 30d dashboard payload synchronously so the page
 *      arrives with data (no client-side loading flash on first paint).
 *   3. Hands off to PlatformAnalyticsClient which owns interactivity
 *      (time-range switch, auto-refresh, panel re-fetch).
 */
export default async function PlatformAnalyticsPage() {
  const session = await auth()
  if (!session?.user?.email) {
    redirect('/login?callbackUrl=/admin/platform-analytics')
  }
  const role = (session.user as any).role as string | undefined
  if (role !== 'admin') {
    redirect('/dashboard')
  }

  const initial = await getDashboardData('30d')

  return <PlatformAnalyticsClient initial={initial} />
}
