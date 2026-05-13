/**
 * POST /api/user/whatsapp/send-otp
 *
 * Send a 6-digit OTP to the supplied WhatsApp phone number to prove
 * possession before it can be saved to notification preferences.
 *
 * Body: { phoneNumber: string }   — E.164 format
 *
 * Auth: any authenticated user
 * Rate limit: 1 send per 60s per user (Twilio cost protection)
 * CSRF: required
 */

import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { validateCsrfToken, csrfErrorResponse } from '@/lib/csrf'
import { whatsappOtpSendRateLimit } from '@/lib/rate-limit-upstash'
import { sendOtp, WhatsappOtpError } from '@/server/whatsappOtpService'

const E164 = /^\+[1-9]\d{6,14}$/

export async function POST(req: NextRequest) {
  if (!validateCsrfToken(req)) return csrfErrorResponse()

  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = (session.user as any).id as string

  const rl = await whatsappOtpSendRateLimit.limit(userId)
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Please wait a minute before requesting another code.' },
      { status: 429 }
    )
  }

  let body: { phoneNumber?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const phoneNumber = (body.phoneNumber || '').trim()
  if (!phoneNumber || !E164.test(phoneNumber)) {
    return NextResponse.json(
      {
        error:
          'Invalid phone number. Use international E.164 format starting with + and your country code (e.g. +919876543210).',
      },
      { status: 400 }
    )
  }

  try {
    await sendOtp(userId, phoneNumber)
    return NextResponse.json({ success: true, message: 'Code sent via WhatsApp.' })
  } catch (err) {
    if (err instanceof WhatsappOtpError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    console.error('[whatsapp/send-otp]', err)
    return NextResponse.json({ error: 'Failed to send code. Please try again.' }, { status: 500 })
  }
}
