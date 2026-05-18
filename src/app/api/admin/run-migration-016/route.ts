import { NextRequest, NextResponse } from 'next/server'
import { pgClient } from '@/db'

/**
 * Run migration 016: Scheduled Product Launch
 * POST /api/admin/run-migration-016
 * Header: x-api-key: <ADMIN_API_KEY>
 *
 * Adds:
 *   - products.launch_status TEXT NOT NULL DEFAULT 'live'
 *     ('live' = visible everywhere, 'scheduled' = owner-only until cron flips)
 *   - products.scheduled_launch_at TIMESTAMP NULL
 *   - Partial index on (scheduled_launch_at) WHERE launch_status='scheduled'
 *     — keeps the cron `getDueScheduledProducts()` lookup cheap.
 *
 * Idempotent: ADD COLUMN IF NOT EXISTS + CREATE INDEX IF NOT EXISTS.
 * Existing rows backfill to 'live' via the DEFAULT clause.
 */
export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key')
  if (!process.env.ADMIN_API_KEY || apiKey !== process.env.ADMIN_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: { name: string; status: string }[] = []

  try {
    await pgClient.unsafe(`
      ALTER TABLE products
        ADD COLUMN IF NOT EXISTS launch_status TEXT NOT NULL DEFAULT 'live'
    `)
    results.push({ name: 'products.launch_status', status: 'added' })

    await pgClient.unsafe(`
      ALTER TABLE products
        ADD COLUMN IF NOT EXISTS scheduled_launch_at TIMESTAMP
    `)
    results.push({ name: 'products.scheduled_launch_at', status: 'added' })

    // Partial index — only the scheduled rows are interesting; live rows
    // (the vast majority) never enter this index.
    await pgClient.unsafe(`
      CREATE INDEX IF NOT EXISTS idx_products_scheduled_due
        ON products (scheduled_launch_at)
        WHERE launch_status = 'scheduled'
    `)
    results.push({ name: 'idx_products_scheduled_due', status: 'created' })

    return NextResponse.json({
      success: true,
      message: 'Migration 016 completed: Scheduled product launch',
      results,
    })
  } catch (error) {
    console.error('[Migration 016] Error:', error)
    return NextResponse.json(
      {
        error: 'Migration 016 failed',
        details: error instanceof Error ? error.message : String(error),
        completedSteps: results,
      },
      { status: 500 },
    )
  }
}
