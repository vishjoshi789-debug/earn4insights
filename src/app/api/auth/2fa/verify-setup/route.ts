import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { validateCsrfToken, csrfErrorResponse } from '@/lib/csrf'
import { twoFactorManageRateLimit } from '@/lib/rate-limit-upstash'
import { verifyAndEnable } from '@/server/twoFactorService'
import { sendTwoFactorEnabledEmail } from '@/server/twoFactorEmailService'

/**
 * POST /api/auth/2fa/verify-setup
 *
 * Confirm the first TOTP code and switch 2FA on. Returns 10 recovery
 * codes — shown to the user exactly once, never again.
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

  const result = await verifyAndEnable(userId, code)
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  // Fire-and-forget security alert — never blocks the response.
  void sendTwoFactorEnabledEmail(session.user.email, session.user.name ?? null).catch((err) =>
    console.error('[2fa/verify-setup] alert email failed', err),
  )

  return NextResponse.json({ success: true, recoveryCodes: result.recoveryCodes })
}
