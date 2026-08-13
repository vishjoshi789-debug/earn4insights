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

    // ── cron_runs retention (migration 037) ──────────────────────────────
    // Folded into this job rather than given its own cron: ~33 jobs × 1 row
    // per run is ~12k rows/year, so this is hygiene, not pressure, and a
    // dedicated schedule entry would cost more attention than it saves.
    //
    // ⚠️ Deletes only FINISHED runs. A row still marked 'running' after 90
    // days is a job that died and never reported — the single most valuable
    // row in the table. Sweeping those away would delete the evidence this
    // table exists to preserve.
    let cronRunsDeleted = 0
    try {
      const cronResult = await db.execute(
        sql`DELETE FROM cron_runs
            WHERE started_at < ${cutoff.toISOString()}
              AND status <> 'running'`
      )
      cronRunsDeleted = (cronResult as any)?.rowCount ?? 0
    } catch (err) {
      // Table may not exist yet (037 not applied). Never fail the primary job.
      console.warn('[cleanup] cron_runs retention skipped (non-fatal):', err)
    }

    logger.cronResult('cleanup-analytics-events', true, { deletedCount, cronRunsDeleted, retentionDays })

    return NextResponse.json({
      success: true,
      deletedCount,
      cronRunsDeleted,
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
