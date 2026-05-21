import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { validateCsrfToken, csrfErrorResponse } from '@/lib/csrf'
import { twoFactorManageRateLimit } from '@/lib/rate-limit-upstash'
import { disable2FA } from '@/server/twoFactorService'
import { sendTwoFactorDisabledEmail } from '@/server/twoFactorEmailService'
import { TWO_FACTOR_PROOF_COOKIE } from '@/lib/twoFactor/proofCookie'
import { TRUSTED_DEVICE_COOKIE } from '@/lib/twoFactor/devices'

/**
 * POST /api/auth/2fa/disable
 *
 * Disable 2FA. Requires the account password as a second confirmation.
 * Wipes the secret, recovery codes, and every trusted device.
 *
 * Body: { password } · Auth: required · CSRF: required
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

  let body: { password?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const password = body.password || ''
  if (!password) {
    return NextResponse.json({ error: 'Password is required to disable 2FA.' }, { status: 400 })
  }

  const result = await disable2FA(userId, password)
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  // Fire-and-forget security alert — never blocks the response.
  void sendTwoFactorDisabledEmail(session.user.email, session.user.name ?? null).catch((err) =>
    console.error('[2fa/disable] alert email failed', err),
  )

  const res = NextResponse.json({ success: true })
  // 2FA is off — clear the proof + trusted-device cookies.
  res.cookies.delete(TWO_FACTOR_PROOF_COOKIE)
  res.cookies.delete(TRUSTED_DEVICE_COOKIE)
  return res
}
