import 'server-only'

import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { platformAnalyticsRateLimit, type Limiter } from '@/lib/rate-limit-upstash'

export type AdminAuthResult =
  | { ok: true; userId: string; email: string }
  | { ok: false; response: NextResponse }

/**
 * Standard admin-gated auth + rate limit for /api/admin/platform-analytics/*.
 *   - Unauthenticated     → 401
 *   - Role !== 'admin'    → 403
 *   - Rate limited        → 429 (with Retry-After header)
 *
 * Note: role check uses `(session.user as any).role` cast — the UserRole
 * union doesn't include 'admin' but the DB column does (admins are real
 * users whose role is set manually). Same pattern used everywhere else
 * in /admin/* routes.
 *
 * Pass a custom `limiter` to override the default per-route (none of
 * our analytics routes need that today, but keep the seam for later).
 */
export async function requireAdmin(opts?: { limiter?: Limiter }): Promise<AdminAuthResult> {
  const session = await auth()
  if (!session?.user?.email) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  const userId = (session.user as any).id as string | undefined
  const role = (session.user as any).role as string | undefined
  if (!userId || role !== 'admin') {
    return { ok: false, response: NextResponse.json({ error: 'Admin access only' }, { status: 403 }) }
  }

  const limiter = opts?.limiter ?? platformAnalyticsRateLimit
  const rl = await limiter.limit(userId)
  if (!rl.success) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Rate limit exceeded', resetAt: rl.reset },
        {
          status: 429,
          headers: { 'Retry-After': String(Math.ceil((rl.reset - Date.now()) / 1000)) },
        },
      ),
    }
  }
  return { ok: true, userId, email: session.user.email }
}
