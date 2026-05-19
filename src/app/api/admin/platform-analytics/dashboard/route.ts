import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '../_auth'
import { getDashboardData } from '@/server/platformAnalyticsService'
import type { TimeRange } from '@/lib/types/platformAnalytics'

/**
 * GET /api/admin/platform-analytics/dashboard?range=7d|30d|90d|12m|all
 *
 * Returns the full DashboardPayload — health, overview, userGrowth,
 * retention, revenue, engagement, financial, predictions, support.
 *
 * Defensive: getDashboardData wraps each sub-block in safely(); a single
 * panel failure populates _errors[] but never sinks the response. So
 * this route normally returns 200 even when one chart is broken — the
 * client renders what it can.
 */

const VALID_RANGES: TimeRange[] = ['7d', '30d', '90d', '12m', 'all']

export async function GET(req: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const rangeParam = (req.nextUrl.searchParams.get('range') ?? '30d') as TimeRange
  const range: TimeRange = VALID_RANGES.includes(rangeParam) ? rangeParam : '30d'

  try {
    const payload = await getDashboardData(range)
    return NextResponse.json(payload)
  } catch (err) {
    console.error('[platform-analytics/dashboard] fatal:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Dashboard query failed' },
      { status: 500 },
    )
  }
}
