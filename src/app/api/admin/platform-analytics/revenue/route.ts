import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '../_auth'
import { getRevenueMetrics, type DateRange } from '@/db/repositories/platformAnalyticsRepository'

/**
 * GET /api/admin/platform-analytics/revenue?range=30d|90d|12m
 *
 * Returns daily revenue series + cumulative totals for the selected
 * window. Paise everywhere — UI converts via formatCurrency().
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000
const VALID_RANGES = new Set(['30d', '90d', '12m'])

function rangeFromParam(param: string): DateRange {
  const now = new Date()
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1))
  const days = param === '90d' ? 90 : param === '12m' ? 365 : 30
  return { from: new Date(to.getTime() - days * MS_PER_DAY), to }
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const rangeParam = req.nextUrl.searchParams.get('range') ?? '30d'
  const range = rangeFromParam(VALID_RANGES.has(rangeParam) ? rangeParam : '30d')

  try {
    const rows = await getRevenueMetrics(range)
    let cumGross = 0
    let cumNet = 0
    const daily = rows.map((r) => {
      cumGross += r.grossRevenue
      cumNet += r.netRevenue
      return {
        date: typeof r.date === 'string' ? r.date : new Date(r.date).toISOString().slice(0, 10),
        gross: r.grossRevenue,
        fees: r.platformFees,
        net: r.netRevenue,
        refunds: r.refunds,
        payments: r.paymentCount,
        cumulativeGross: cumGross,
        cumulativeNet: cumNet,
      }
    })
    const totals = {
      gross: rows.reduce((a, r) => a + r.grossRevenue, 0),
      fees: rows.reduce((a, r) => a + r.platformFees, 0),
      net: rows.reduce((a, r) => a + r.netRevenue, 0),
      refunds: rows.reduce((a, r) => a + r.refunds, 0),
      payments: rows.reduce((a, r) => a + r.paymentCount, 0),
    }
    return NextResponse.json({ range: rangeParam, daily, totals })
  } catch (err) {
    console.error('[platform-analytics/revenue] error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Revenue query failed' },
      { status: 500 },
    )
  }
}
