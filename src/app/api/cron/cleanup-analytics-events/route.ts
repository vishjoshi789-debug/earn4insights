import { NextResponse } from 'next/server'
import { db, sql } from '@/db'
import { logger } from '@/lib/logger'

/**
 * Cron: Cleanup old analytics events (retention: 90 days)
 *
 * Deletes analyticsEvents rows older than 90 days to prevent
 * unbounded table growth. Run daily via Vercel Cron.
 *
 * Trigger: GET /api/cron/cleanup-analytics-events
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const retentionDays = 90
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)

    const result = await db.execute(
      sql`DELETE FROM analytics_events WHERE created_at < ${cutoff.toISOString()}`
    )

    const deletedCount = (result as any)?.rowCount ?? 0

    logger.cronResult('cleanup-analytics-events', true, { deletedCount, retentionDays })

    return NextResponse.json({
      success: true,
      deletedCount,
      cutoffDate: cutoff.toISOString(),
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    logger.cronResult('cleanup-analytics-events', false, { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json(
      { error: 'Cleanup failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
