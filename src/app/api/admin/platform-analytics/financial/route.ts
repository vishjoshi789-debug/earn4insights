import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '../_auth'
import { getFinancialSnapshots, type DateRange } from '@/db/repositories/platformAnalyticsRepository'

/**
 * GET /api/admin/platform-analytics/financial?months=6|12
 *
 * Returns the trailing N months of financial_snapshots_monthly rows
 * (most-recent first). Drives the Revenue-vs-Costs cumulative chart,
 * cost-breakdown donut, and the LTV / ARPU / runway tiles.
 */

const VALID_MONTHS = new Set(['6', '12'])

function monthRange(months: number): DateRange {
  const now = new Date()
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)) // first of next month
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - months + 1, 1))
  return { from, to }
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const monthsParam = req.nextUrl.searchParams.get('months') ?? '12'
  const months = VALID_MONTHS.has(monthsParam) ? Number(monthsParam) : 12

  try {
    const rows = await getFinancialSnapshots(monthRange(months))
    const snapshots = rows.map((r) => ({
      month: typeof r.month === 'string' ? r.month : new Date(r.month).toISOString().slice(0, 10),
      grossRevenue: r.grossRevenue,
      platformFees: r.platformFees,
      influencerPayouts: r.influencerPayouts,
      consumerRewards: r.consumerRewards,
      refunds: r.refunds,
      netRevenue: r.netRevenue,
      totalCosts: r.totalCosts,
      costBreakdown: r.costBreakdown ?? {},
      grossMargin: r.grossMargin,
      grossMarginPercent: Number(r.grossMarginPercent ?? 0),
      cashBalance: r.cashBalance,
      burnRate: r.burnRate,
      runwayMonths: r.runwayMonths != null ? Number(r.runwayMonths) : null,
      mrr: r.mrr,
      mrrGrowthPercent: Number(r.mrrGrowthPercent ?? 0),
      arpu: r.arpu,
      brandLtv: r.brandLtv,
      consumerLtv: r.consumerLtv,
      computedAt: r.computedAt instanceof Date ? r.computedAt.toISOString() : r.computedAt,
    }))
    return NextResponse.json({ months, snapshots })
  } catch (err) {
    console.error('[platform-analytics/financial] error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Financial query failed' },
      { status: 500 },
    )
  }
}
