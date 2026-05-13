import { NextRequest, NextResponse } from 'next/server'
import { pgClient } from '@/db'

/**
 * Run migration 014: WhatsApp OTP Verifications
 * POST /api/admin/run-migration-014
 * Header: x-api-key: <ADMIN_API_KEY>
 *
 * Creates:
 *   - whatsapp_otp_verifications table (phone number ownership proof)
 *
 * Idempotent: uses IF NOT EXISTS / DO blocks.
 * Prerequisites: migrations 001–013 applied first.
 */
export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key')
  if (!process.env.ADMIN_API_KEY || apiKey !== process.env.ADMIN_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: { name: string; status: string }[] = []

  try {
    await pgClient.unsafe(`
      CREATE TABLE IF NOT EXISTS whatsapp_otp_verifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT NOT NULL,
        phone_number TEXT NOT NULL,
        otp_hash TEXT NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        max_attempts INTEGER NOT NULL DEFAULT 3,
        verified_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `)
    results.push({ name: 'whatsapp_otp_verifications', status: 'created' })

    await pgClient.unsafe(`
      CREATE INDEX IF NOT EXISTS idx_wa_otp_user_phone
        ON whatsapp_otp_verifications(user_id, phone_number)
    `)
    await pgClient.unsafe(`
      CREATE INDEX IF NOT EXISTS idx_wa_otp_verified
        ON whatsapp_otp_verifications(user_id, phone_number, verified_at)
        WHERE verified_at IS NOT NULL
    `)
    results.push({ name: 'whatsapp_otp_verifications indexes', status: 'created' })

    // FK: user_id → users(id) CASCADE — account deletion removes OTP rows
    await pgClient.unsafe(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_wa_otp_user_id') THEN
          ALTER TABLE whatsapp_otp_verifications
            ADD CONSTRAINT fk_wa_otp_user_id
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
        END IF;
      END $$
    `)
    results.push({ name: 'fk_wa_otp_user_id', status: 'created' })

    return NextResponse.json({
      success: true,
      message: 'Migration 014 completed: WhatsApp OTP verifications table',
      results,
    })
  } catch (error) {
    console.error('[Migration 014] Error:', error)
    return NextResponse.json(
      {
        error: 'Migration 014 failed',
        details: error instanceof Error ? error.message : String(error),
        completedSteps: results,
      },
      { status: 500 }
    )
  }
}
