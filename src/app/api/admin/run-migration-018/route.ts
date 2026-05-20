import { NextRequest, NextResponse } from 'next/server'
import { pgClient } from '@/db'

/**
 * Run migration 018: WhatsApp OTP → Twilio Verify
 * POST /api/admin/run-migration-018
 * Header: x-api-key: <ADMIN_API_KEY>
 *
 * WhatsApp phone verification moved from a hand-rolled OTP (bcrypt hash +
 * TTL + attempt counter stored in `whatsapp_otp_verifications`) to Twilio
 * Verify, which owns the OTP lifecycle. The table now stores only
 * verified-phone markers, so `otp_hash` and `expires_at` are no longer
 * populated — drop their NOT NULL constraints so a marker row can be
 * inserted with just (user_id, phone_number, verified_at).
 *
 * Idempotent: DROP NOT NULL is a no-op if the constraint is already gone.
 */
export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key')
  if (!process.env.ADMIN_API_KEY || apiKey !== process.env.ADMIN_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: { name: string; status: string }[] = []

  try {
    await pgClient.unsafe(`
      ALTER TABLE whatsapp_otp_verifications
        ALTER COLUMN otp_hash DROP NOT NULL
    `)
    results.push({ name: 'whatsapp_otp_verifications.otp_hash', status: 'nullable' })

    await pgClient.unsafe(`
      ALTER TABLE whatsapp_otp_verifications
        ALTER COLUMN expires_at DROP NOT NULL
    `)
    results.push({ name: 'whatsapp_otp_verifications.expires_at', status: 'nullable' })

    return NextResponse.json({
      success: true,
      message: 'Migration 018 completed: WhatsApp OTP columns relaxed for Twilio Verify',
      results,
    })
  } catch (error) {
    console.error('[Migration 018] Error:', error)
    return NextResponse.json(
      {
        error: 'Migration 018 failed',
        details: error instanceof Error ? error.message : String(error),
        completedSteps: results,
      },
      { status: 500 },
    )
  }
}
