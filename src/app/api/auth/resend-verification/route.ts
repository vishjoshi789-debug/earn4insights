/**
 * Resend email verification (Phase EV.1).
 * POST /api/auth/resend-verification
 *
 * Auth: logged-in user only.
 * Rate-limited: 3 per hour per userId (verificationResendRateLimit).
 *
 * Enumeration-safe by being auth-gated — the caller is already
 * signed in, so we don't need to mask "user not found" the way
 * forgot-password does. Still neutral on "already verified" / "no
 * email needed" — return success either way so a malicious script
 * can't infer state by retrying.
 *
 * CSRF: state-mutating POST. Per project pattern, gated by
 * validateCsrfToken which the middleware refreshes on every request.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { validateCsrfToken, csrfErrorResponse } from '@/lib/csrf'
import { verificationResendRateLimit } from '@/lib/rate-limit-upstash'
import { resendVerificationEmail } from '@/server/emailVerificationService'

export async function POST(req: NextRequest) {
  if (!validateCsrfToken(req)) return csrfErrorResponse()

  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = session.user.id as string

  // Rate limit by userId so a single account can't flood the resend
  // endpoint. 3/hour matches the spec (EV.1 Q2).
  const rl = await verificationResendRateLimit.limit(userId)
  if (!rl.success) {
    return NextResponse.json(
      {
        error: 'Too many resend attempts. Please wait before trying again.',
        retryAfter: Math.max(1, Math.ceil((rl.reset - Date.now()) / 1000)),
      },
      { status: 429 },
    )
  }

  // Service handles "already verified" / "user not found" silently.
  // Whatever the outcome, return success to the client — the resend
  // flow shouldn't reveal whether the email is verified or not. The
  // UI just shows "If your email is unverified, a new link has been
  // sent to your inbox" regardless.
  await resendVerificationEmail(userId).catch((err) => {
    console.error('[ResendVerification] Send failed:', err)
  })

  return NextResponse.json({
    ok: true,
    message:
      'If your email is unverified, a new verification link has been sent to your inbox.',
  })
}
