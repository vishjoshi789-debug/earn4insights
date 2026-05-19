/**
 * Cron: Compute Financial Snapshots (monthly)
 * GET /api/cron/compute-financial-snapshots
 *
 * Schedule:
 *   - Monthly on the 1st at 03:00 UTC via vercel.json. Snapshots the
 *     PREVIOUS month so the data window is complete.
 *
 * Behaviour:
 *   - Default: computes the snapshot for last month.
 *   - ?month=YYYY-MM: recomputes that specific month (idempotent —
 *     useful when admin has added/edited costs and wants the snapshot
 *     to reflect those changes immediately).
 *   - ?months=N: walks back N months (cap 12), useful for one-shot
 *     historical seed after migration 017.
 *
 * The cash_balance column is read from the existing snapshot row (if
 * any) and carried over — costs/revenue only updates re-derive the
 * other fields. Pass `?cashBalance=XXXX` (paise) to override during
 * a recompute.
 *
 * Auth: Bearer CRON_SECRET.
 */

import { NextRequest, NextResponse } from 'next/server'
import { computeFinancialSnapshot } from '@/server/platformAnalyticsService'

const MAX_MONTHS = 12

function startOfUtcMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
}
function addMonths(d: Date, n: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1))
}

function parseMonthParam(value: string): Date | null {
  const m = value.match(/^(\d{4})-(\d{2})(?:-\d{2})?$/)
  if (!m) return null
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 1))
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startedAt = new Date().toISOString()
  const monthParam = request.nextUrl.searchParams.get('month')
  const monthsParam = request.nextUrl.searchParams.get('months')
  const cashBalanceParam = request.nextUrl.searchParams.get('cashBalance')
  const cashOverride = cashBalanceParam != null && /^\d+$/.test(cashBalanceParam)
    ? Number(cashBalanceParam)
    : undefined

  // Build the list of months to compute.
  let targets: Date[]
  if (monthParam) {
    const m = parseMonthParam(monthParam)
    if (!m) {
      return NextResponse.json({ error: 'Invalid month — use YYYY-MM' }, { status: 400 })
    }
    targets = [m]
  } else if (monthsParam) {
    const requested = Math.max(1, parseInt(monthsParam, 10))
    const count = Math.min(requested, MAX_MONTHS)
    const lastMonth = addMonths(startOfUtcMonth(new Date()), -1)
    targets = Array.from({ length: count }, (_, i) => addMonths(lastMonth, -i))
  } else {
    // Default — last month only.
    targets = [addMonths(startOfUtcMonth(new Date()), -1)]
  }

  const results: Array<{ month: string; ok: boolean; error?: string }> = []
  let success = 0
  let failed = 0

  for (const m of targets) {
    const monthStr = m.toISOString().slice(0, 10)
    try {
      await computeFinancialSnapshot(m, cashOverride != null ? { cashBalance: cashOverride } : undefined)
      results.push({ month: monthStr, ok: true })
      success += 1
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[compute-financial-snapshots] month=${monthStr} failed:`, err)
      results.push({ month: monthStr, ok: false, error: msg })
      failed += 1
    }
  }

  return NextResponse.json(
    {
      success: failed === 0,
      startedAt,
      finishedAt: new Date().toISOString(),
      stats: { success, failed },
      results,
    },
    { status: failed === 0 ? 200 : 207 },
  )
}
