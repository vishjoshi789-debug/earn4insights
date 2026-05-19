/**
 * Cron: Compute Retention Cohorts (weekly)
 * GET /api/cron/compute-retention-cohorts
 *
 * Schedule:
 *   - Weekly on Sundays at 02:00 UTC via vercel.json. Cohort percentages
 *     for newly-matured cells (e.g. last week's cohort hitting Day-7)
 *     don't change between recomputes, so a weekly cadence is enough.
 *
 * Behaviour:
 *   - Calls computeRetentionCohorts(weeksBack), which iterates over all
 *     four roles ('all', 'brand', 'consumer', 'influencer') and upserts
 *     one row per (cohort_date, role, 'weekly') tuple.
 *   - Default window: 12 weeks. Pass ?weeks=N to override (max 26 —
 *     longer windows blow past the function timeout because the cohort
 *     query joins users × analytics_events).
 *
 * Auth: Bearer CRON_SECRET.
 */

import { NextRequest, NextResponse } from 'next/server'
import { computeRetentionCohorts } from '@/server/platformAnalyticsService'

const MAX_WEEKS = 26
const DEFAULT_WEEKS = 12

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startedAt = new Date().toISOString()
  const weeksParam = request.nextUrl.searchParams.get('weeks')
  const requested = weeksParam ? Math.max(1, parseInt(weeksParam, 10)) : DEFAULT_WEEKS
  const weeks = Math.min(requested, MAX_WEEKS)

  try {
    const stats = await computeRetentionCohorts(weeks)
    return NextResponse.json({
      success: true,
      startedAt,
      finishedAt: new Date().toISOString(),
      weeks,
      ...stats,
    })
  } catch (err) {
    console.error('[compute-retention-cohorts] fatal:', err)
    return NextResponse.json(
      {
        success: false,
        startedAt,
        finishedAt: new Date().toISOString(),
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    )
  }
}
