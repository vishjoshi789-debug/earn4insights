import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { validateCsrfToken, csrfErrorResponse } from '@/lib/csrf'
import { twoFactorChallengeRateLimit, twoFactorLockoutNotifyRateLimit } from '@/lib/rate-limit-upstash'
import { verifyRecoveryCode, countRemainingRecoveryCodes } from '@/server/twoFactorService'
import { sendRecoveryCodeUsedEmail, sendTwoFactorLockoutEmail } from '@/server/twoFactorEmailService'
import {
  signProofCookie,
  TWO_FACTOR_PROOF_COOKIE,
  TWO_FACTOR_PROOF_TTL_MS,
} from '@/lib/twoFactor/proofCookie'

/**
 * POST /api/auth/2fa/recovery
 *
 * Verify a single-use recovery code during a login challenge. The code
 * is burned on success. Sets the `e4i-2fa` proof cookie like /verify.
 *
 * Body: { recoveryCode } · Session required · CSRF: required
 */
const PROD = process.env.NODE_ENV === 'production'

export async function POST(req: NextRequest) {
  if (!validateCsrfToken(req)) return csrfErrorResponse()

  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = (session.user as any).id as string

  const rl = await twoFactorChallengeRateLimit.limit(userId)
  if (!rl.success) {
    // One lockout alert per 15-min window (gated by a 1/15m limiter).
    if ((await twoFactorLockoutNotifyRateLimit.limit(userId)).success) {
      void sendTwoFactorLockoutEmail(session.user.email, session.user.name ?? null).catch((err) =>
        console.error('[2fa/recovery] lockout email failed', err),
      )
    }
    return NextResponse.json(
      { error: 'Too many attempts. Try again in 15 minutes.', locked: true },
      { status: 429 },
    )
  }

  let body: { recoveryCode?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const recoveryCode = (body.recoveryCode || '').trim()
  if (!recoveryCode) {
    return NextResponse.json({ error: 'Enter a recovery code.' }, { status: 400 })
  }

  const ok = await verifyRecoveryCode(userId, recoveryCode)
  if (!ok) {
    return NextResponse.json({ error: 'Invalid recovery code' }, { status: 400 })
  }

  const remainingCodes = await countRemainingRecoveryCodes(userId)

  // Fire-and-forget security alert — never blocks the response.
  void sendRecoveryCodeUsedEmail(
    session.user.email,
    session.user.name ?? null,
    remainingCodes,
  ).catch((err) => console.error('[2fa/recovery] alert email failed', err))

  const res = NextResponse.json({ success: true, redirect: '/dashboard', remainingCodes })

  const loginNonce = session.loginNonce || userId
  res.cookies.set({
    name: TWO_FACTOR_PROOF_COOKIE,
    value: await signProofCookie(loginNonce),
    httpOnly: true,
    secure: PROD,
    sameSite: 'lax',
    path: '/',
    maxAge: Math.floor(TWO_FACTOR_PROOF_TTL_MS / 1000),
  })
  return res
}
