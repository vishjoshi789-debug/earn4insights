import 'server-only'

import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { competitiveReadRateLimit, type Limiter } from '@/lib/rate-limit-upstash'

export type BrandAuthResult =
  | { ok: true; userId: string }
  | { ok: false; response: NextResponse }

/**
 * Standard brand-gated auth for Competitive Intelligence routes.
 * - Unauthenticated → 401
 * - Non-brand role  → 403
 * - Rate limited     → 429
 *
 * Pass a specific limiter for routes with stricter limits (e.g.
 * competitiveAiGenerateRateLimit, competitiveRecomputeRateLimit).
 * Defaults to competitiveReadRateLimit when omitted.
 */
export async function requireBrand(
  _req: Request,
  opts?: { limiter?: Limiter }
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

  const limiter = opts?.limiter ?? competitiveReadRateLimit
  const rl = await limiter.limit(userId)
  if (!rl.success) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Rate limit exceeded', resetAt: rl.reset },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.reset - Date.now()) / 1000)) } }
      ),
    }
  }
  return { ok: true, userId }
}
