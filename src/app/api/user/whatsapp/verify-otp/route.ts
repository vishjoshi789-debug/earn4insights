/**
 * POST /api/user/whatsapp/verify-otp
 *
 * Verify a 6-digit OTP for the supplied WhatsApp phone number. On
 * success, the (userId, phoneNumber) pair is marked verified — saving the
 * number to notification settings becomes allowed.
 *
 * Body: { phoneNumber: string, otp: string }
 *
 * Auth: any authenticated user
 * CSRF: required
 */

import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { validateCsrfToken, csrfErrorResponse } from '@/lib/csrf'
import { verifyOtp } from '@/server/whatsappOtpService'

const E164 = /^\+[1-9]\d{6,14}$/

export async function POST(req: NextRequest) {
  if (!validateCsrfToken(req)) return csrfErrorResponse()

  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = (session.user as any).id as string

  let body: { phoneNumber?: string; otp?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const phoneNumber = (body.phoneNumber || '').trim()
  const otp = (body.otp || '').trim()

  if (!phoneNumber || !E164.test(phoneNumber)) {
    return NextResponse.json({ error: 'Invalid phone number.' }, { status: 400 })
  }
  if (!otp || !/^\d{6}$/.test(otp)) {
    return NextResponse.json({ error: 'Code must be 6 digits.' }, { status: 400 })
  }

  const result = await verifyOtp(userId, phoneNumber, otp)
  if (result.success) {
    return NextResponse.json({ success: true })
  }

  switch (result.reason) {
    case 'no_active_otp':
      return NextResponse.json(
        { error: 'No active verification code. Please request a new one.' },
        { status: 400 }
      )
    case 'too_many_attempts':
      return NextResponse.json(
        { error: 'Too many attempts. Please request a new code.' },
        { status: 400 }
      )
    case 'invalid_otp':
      return NextResponse.json(
        {
          error: 'Incorrect code.',
          attemptsRemaining: result.attemptsRemaining,
        },
        { status: 400 }
      )
    default:
      return NextResponse.json({ error: 'Verification failed.' }, { status: 400 })
  }
}
