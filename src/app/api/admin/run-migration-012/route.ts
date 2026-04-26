import { NextRequest, NextResponse } from 'next/server'
import { pgClient } from '@/db'

/**
 * Run migration 012: DSAR Requests (GDPR Article 15)
 * POST /api/admin/run-migration-012
 * Header: x-api-key: <ADMIN_API_KEY>
 *
 * Creates:
 *   - dsar_requests table (Data Subject Access Request tracking)
 *
 * Idempotent: uses IF NOT EXISTS / DO blocks.
 * Prerequisites: migrations 001–011 applied first.
 */
export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key')
  if (!process.env.ADMIN_API_KEY || apiKey !== process.env.ADMIN_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: { name: string; status: string }[] = []

  try {
    await pgClient.unsafe(`
      CREATE TABLE IF NOT EXISTS dsar_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        consumer_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        otp_hash TEXT,
        otp_expires_at TIMESTAMP,
        otp_attempts INTEGER NOT NULL DEFAULT 0,
        max_otp_attempts INTEGER NOT NULL DEFAULT 3,
        pdf_url TEXT,
        pdf_generated_at TIMESTAMP,
        email_sent_at TIMESTAMP,
        expires_at TIMESTAMP,
        ip_address TEXT,
        user_agent TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `)
    results.push({ name: 'dsar_requests', status: 'created' })

    await pgClient.unsafe(`
      CREATE INDEX IF NOT EXISTS idx_dsar_consumer_created
        ON dsar_requests(consumer_id, created_at DESC)
    `)
    await pgClient.unsafe(`
      CREATE INDEX IF NOT EXISTS idx_dsar_status_created
        ON dsar_requests(status, created_at)
    `)
    results.push({ name: 'dsar_requests indexes', status: 'created' })

    // FK: consumer_id → users(id) CASCADE — account deletion removes DSAR records
    await pgClient.unsafe(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_dsar_consumer_id') THEN
          ALTER TABLE dsar_requests
            ADD CONSTRAINT fk_dsar_consumer_id
            FOREIGN KEY (consumer_id) REFERENCES users(id) ON DELETE CASCADE;
        END IF;
      END $$
    `)
    results.push({ name: 'fk_dsar_consumer_id', status: 'created' })

    return NextResponse.json({
      success: true,
      message: 'Migration 012 completed: DSAR requests table (GDPR Art. 15)',
      results,
    })
  } catch (error) {
    console.error('[Migration 012] Error:', error)
    return NextResponse.json(
      {
        error: 'Migration 012 failed',
        details: error instanceof Error ? error.message : String(error),
        completedSteps: results,
      },
      { status: 500 }
    )
  }
}
