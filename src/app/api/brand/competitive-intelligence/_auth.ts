import 'server-only'

import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { checkRateLimit, getRateLimitKey, RATE_LIMITS, type RateLimitConfig } from '@/lib/rate-limit'

export type BrandAuthResult =
  | { ok: true; userId: string }
  | { ok: false; response: NextResponse }

/**
 * Standard brand-gated auth for Competitive Intelligence routes.
 * - Unauthenticated → 401
 * - Non-brand role  → 403
 * - Rate limited     → 429
 */
export async function requireBrand(
  req: Request,
  opts?: { limit?: RateLimitConfig; limitKeyPrefix?: string }
): Promise<BrandAuthResult> {
  const session = await auth()
  if (!session?.user?.email) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  const userId = (session.user as any).id as string | undefined
  const role = (session.user as any).role as string | undefined
  if (!userId || role !== 'brand') {
    return { ok: false, response: NextResponse.json({ error: 'Brand access only' }, { status: 403 }) }
  }

  const limit = opts?.limit ?? RATE_LIMITS.competitiveRead
  const keyPrefix = opts?.limitKeyPrefix ?? 'ci'
  const rl = checkRateLimit(getRateLimitKey(req, `${keyPrefix}:${userId}`), limit)
  if (!rl.allowed) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Rate limit exceeded', resetAt: rl.resetAt },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
      ),
    }
  }
  return { ok: true, userId }
}
