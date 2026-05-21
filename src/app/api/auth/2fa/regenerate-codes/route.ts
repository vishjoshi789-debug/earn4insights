import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { validateCsrfToken, csrfErrorResponse } from '@/lib/csrf'
import { twoFactorManageRateLimit } from '@/lib/rate-limit-upstash'
import { regenerateRecoveryCodes } from '@/server/twoFactorService'

/**
 * POST /api/auth/2fa/regenerate-codes
 *
 * Replace all recovery codes with a fresh set. Requires a current TOTP
 * code as confirmation. Returns the new codes — shown only once.
 *
 * Body: { code } · Auth: required · CSRF: required
 */
export async function POST(req: NextRequest) {
  if (!validateCsrfToken(req)) return csrfErrorResponse()

  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = (session.user as any).id as string

  const rl = await twoFactorManageRateLimit.limit(userId)
  if (!rl.success) {
    return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 })
  }

  let body: { code?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const code = (body.code || '').trim()
  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json(
      { error: 'Enter the 6-digit code from your authenticator app.' },
      { status: 400 },
    )
  }

  const result = await regenerateRecoveryCodes(userId, code)
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }
  return NextResponse.json({ success: true, recoveryCodes: result.recoveryCodes })
}
