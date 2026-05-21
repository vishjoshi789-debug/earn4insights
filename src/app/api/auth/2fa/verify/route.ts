import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { validateCsrfToken, csrfErrorResponse } from '@/lib/csrf'
import { twoFactorChallengeRateLimit, twoFactorLockoutNotifyRateLimit } from '@/lib/rate-limit-upstash'
import { verifyCode, trustDevice } from '@/server/twoFactorService'
import { sendNewDeviceTrustedEmail, sendTwoFactorLockoutEmail } from '@/server/twoFactorEmailService'
import {
  signProofCookie,
  TWO_FACTOR_PROOF_COOKIE,
  TWO_FACTOR_PROOF_TTL_MS,
} from '@/lib/twoFactor/proofCookie'
import { TRUSTED_DEVICE_COOKIE, TRUSTED_DEVICE_TTL_DAYS } from '@/lib/twoFactor/devices'

/**
 * POST /api/auth/2fa/verify
 *
 * Verify a TOTP code during a login challenge. On success sets the
 * `e4i-2fa` proof cookie (clears the requires2FA gate) and, if asked,
 * the `e4i-trusted-device` cookie.
 *
 * Body: { code, trustDevice? } · Session required · CSRF: required
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
        console.error('[2fa/verify] lockout email failed', err),
      )
    }
    return NextResponse.json(
      { error: 'Too many attempts. Try again in 15 minutes.', locked: true },
      { status: 429 },
    )
  }

  let body: { code?: string; trustDevice?: boolean }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const code = (body.code || '').trim()
  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: 'Enter the 6-digit code.' }, { status: 400 })
  }

  const ok = await verifyCode(userId, code)
  if (!ok) {
    return NextResponse.json({ error: 'Invalid code', remaining: rl.remaining }, { status: 400 })
  }

  const res = NextResponse.json({ success: true, redirect: '/dashboard' })

  // Proof cookie — bound to this login's nonce so it can't outlive it.
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

  // Optional — skip the challenge on this device for 30 days.
  if (body.trustDevice === true) {
    const { cookieValue, deviceName } = await trustDevice(userId, req.headers.get('user-agent'))
    res.cookies.set({
      name: TRUSTED_DEVICE_COOKIE,
      value: cookieValue,
      httpOnly: true,
      secure: PROD,
      sameSite: 'lax',
      path: '/',
      maxAge: TRUSTED_DEVICE_TTL_DAYS * 24 * 60 * 60,
    })
    void sendNewDeviceTrustedEmail(
      session.user.email,
      session.user.name ?? null,
      deviceName,
    ).catch((err) => console.error('[2fa/verify] new-device email failed', err))
  }

  return res
}
