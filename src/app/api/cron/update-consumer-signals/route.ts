/**
 * Cron: Update Consumer Signals
 * GET /api/cron/update-consumer-signals
 *
 * Runs daily at 02:30 UTC (see vercel.json).
 * Collects and persists per-category signal snapshots for all users,
 * then purges snapshots older than SIGNAL_RETENTION_DAYS.
 *
 * Auth: Bearer CRON_SECRET header (Vercel Cron injects this automatically).
 */

import { NextRequest, NextResponse } from 'next/server'
import { runUpdateConsumerSignals } from '@/server/updateConsumerSignals'

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await runUpdateConsumerSignals()

    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (error) {
    console.error('[Cron update-consumer-signals] Fatal error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}
