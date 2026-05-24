import { NextRequest, NextResponse } from 'next/server'
import { pgClient } from '@/db'

/**
 * Run migration 020: Social Listening — Telegram offset state + verified
 * social handles on consumer_social_connections.
 *
 * POST /api/admin/run-migration-020
 * Header: x-api-key: <ADMIN_API_KEY>
 *
 * Adds:
 *   - telegram_bot_state                           — single-row KV for the
 *     Telegram getUpdates offset cursor. CHECK (id = 1) keeps it single-row.
 *   - consumer_social_connections.verified_handle  — human-readable username
 *     captured at OAuth time (NULL when the platform doesn't expose one)
 *   - consumer_social_connections.verified_subject — opaque immutable id
 *     (e.g. LinkedIn URN urn:li:person:..., Reddit user id)
 *   - consumer_social_connections.handle_verified_at
 *   - idx_csc_platform_handle / idx_csc_platform_subject — partial indexes
 *     used by the handle-attribution lookup (only active, non-revoked rows)
 *
 * Idempotent: every step uses IF NOT EXISTS / ON CONFLICT DO NOTHING.
 */
export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key')
  if (!process.env.ADMIN_API_KEY || apiKey !== process.env.ADMIN_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: { name: string; status: string }[] = []

  try {
    await pgClient.unsafe(`
      CREATE TABLE IF NOT EXISTS telegram_bot_state (
        id             INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
        last_update_id BIGINT NOT NULL DEFAULT 0,
        updated_at     TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `)
    results.push({ name: 'telegram_bot_state', status: 'created' })

    await pgClient.unsafe(`
      INSERT INTO telegram_bot_state (id) VALUES (1)
        ON CONFLICT (id) DO NOTHING
    `)
    results.push({ name: 'telegram_bot_state seed row', status: 'ensured' })

    await pgClient.unsafe(`
      ALTER TABLE consumer_social_connections
        ADD COLUMN IF NOT EXISTS verified_handle    TEXT,
        ADD COLUMN IF NOT EXISTS verified_subject   TEXT,
        ADD COLUMN IF NOT EXISTS handle_verified_at TIMESTAMP
    `)
    results.push({ name: 'consumer_social_connections.verified_*', status: 'added' })

    await pgClient.unsafe(`
      CREATE INDEX IF NOT EXISTS idx_csc_platform_handle
        ON consumer_social_connections (platform, LOWER(verified_handle))
        WHERE verified_handle IS NOT NULL AND revoked_at IS NULL
    `)
    results.push({ name: 'idx_csc_platform_handle', status: 'created' })

    await pgClient.unsafe(`
      CREATE INDEX IF NOT EXISTS idx_csc_platform_subject
        ON consumer_social_connections (platform, verified_subject)
        WHERE verified_subject IS NOT NULL AND revoked_at IS NULL
    `)
    results.push({ name: 'idx_csc_platform_subject', status: 'created' })

    return NextResponse.json({
      success: true,
      message: 'Migration 020 completed: Telegram offset + verified social handles',
      results,
    })
  } catch (error) {
    console.error('[Migration 020] Error:', error)
    return NextResponse.json(
      {
        error: 'Migration 020 failed',
        details: error instanceof Error ? error.message : String(error),
        completedSteps: results,
      },
      { status: 500 },
    )
  }
}
