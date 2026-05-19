/**
 * Cron: Compute Platform Metrics (daily)
 * GET /api/cron/compute-platform-metrics
 *
 * Schedule:
 *   - Daily at 01:00 UTC via vercel.json (also driven by cron-job.org
 *     as a redundancy layer with the same Bearer secret).
 *
 * Behaviour:
 *   - Default: computes platform_metrics_daily + revenue_metrics_daily
 *     for YESTERDAY's UTC day (so we have a complete day of data). The
 *     upsert keys on `date`, so re-running the same day is a no-op.
 *   - ?backfill=N: walks back N days, computing each in sequence.
 *     Capped at 30 to stay safely under Vercel function timeouts;
 *     larger windows require multiple invocations (acceptable since
 *     it's a one-shot historical seed, not steady-state).
 *
 * Auth: Bearer CRON_SECRET (Vercel injects this for scheduled runs).
 *
 * Returns 200 with a summary including per-day success/failure list.
 */

import { NextRequest, NextResponse } from 'next/server'
import { computeDailyMetrics, computeRevenueMetrics } from '@/server/platformAnalyticsService'

const MS_PER_DAY = 24 * 60 * 60 * 1000
const MAX_BACKFILL_DAYS = 30

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startedAt = new Date().toISOString()
  const backfillParam = request.nextUrl.searchParams.get('backfill')
  const requested = backfillParam ? Math.max(1, parseInt(backfillParam, 10)) : 1
  const backfillDays = Math.min(requested, MAX_BACKFILL_DAYS)
  const truncated = requested > MAX_BACKFILL_DAYS

  // Walk back from yesterday — never compute today, since today's row
  // would be incomplete (cron may fire at any hour relative to user TZ).
  const yesterday = startOfUtcDay(new Date(Date.now() - MS_PER_DAY))

  const results: Array<{ date: string; ok: boolean; error?: string }> = []
  let success = 0
  let failed = 0

  for (let i = 0; i < backfillDays; i++) {
    const day = new Date(yesterday.getTime() - i * MS_PER_DAY)
    const dayStr = day.toISOString().slice(0, 10)
    try {
      await Promise.all([
        computeDailyMetrics(day),
        computeRevenueMetrics(day),
      ])
      results.push({ date: dayStr, ok: true })
      success += 1
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[compute-platform-metrics] day=${dayStr} failed:`, err)
      results.push({ date: dayStr, ok: false, error: msg })
      failed += 1
    }
  }

  return NextResponse.json(
    {
      success: failed === 0,
      startedAt,
      finishedAt: new Date().toISOString(),
      backfillDays,
      truncated,
      stats: { success, failed },
      results,
    },
    { status: failed === 0 ? 200 : 207 },
  )
}
