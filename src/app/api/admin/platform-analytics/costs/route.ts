import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '../_auth'
import { validateCsrfToken } from '@/lib/csrf'
import { addCost, getCosts, isValidCostCategory } from '@/db/repositories/platformAnalyticsRepository'

/**
 * GET  /api/admin/platform-analytics/costs?month=YYYY-MM
 * POST /api/admin/platform-analytics/costs
 *      body: { month: 'YYYY-MM' | 'YYYY-MM-DD',
 *              category: CostCategory,
 *              amount: number (paise),
 *              description?: string,
 *              isRecurring?: boolean,
 *              currency?: 'INR' }
 *
 * Month is normalised to first-of-month (DATE column in Postgres).
 * Amount is stored in paise. cash_balance is NOT updated here — it's
 * a column on financial_snapshots_monthly, updated by the cron when
 * recomputing the monthly snapshot OR via the dashboard cost form
 * (TODO Phase 6 — for now, defaults to existing snapshot value).
 */

function parseMonth(value: string): Date | null {
  // Accept 'YYYY-MM' or 'YYYY-MM-DD'; always snap to first of month.
  const m1 = value.match(/^(\d{4})-(\d{2})$/)
  const m2 = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (m1) {
    return new Date(Date.UTC(Number(m1[1]), Number(m1[2]) - 1, 1))
  }
  if (m2) {
    return new Date(Date.UTC(Number(m2[1]), Number(m2[2]) - 1, 1))
  }
  return null
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const monthRaw = req.nextUrl.searchParams.get('month')
  if (!monthRaw) {
    return NextResponse.json({ error: 'month query param required (YYYY-MM)' }, { status: 400 })
  }
  const month = parseMonth(monthRaw)
  if (!month) {
    return NextResponse.json({ error: 'Invalid month — use YYYY-MM' }, { status: 400 })
  }
  try {
    const rows = await getCosts(month)
    const totalsByCategory: Record<string, number> = {}
    let grandTotal = 0
    for (const r of rows) {
      totalsByCategory[r.category] = (totalsByCategory[r.category] ?? 0) + Number(r.amount)
      grandTotal += Number(r.amount)
    }
    return NextResponse.json({
      month: month.toISOString().slice(0, 10),
      costs: rows.map((r) => ({
        id: r.id,
        category: r.category,
        description: r.description,
        amount: r.amount,
        currency: r.currency,
        isRecurring: r.isRecurring,
        enteredBy: r.enteredBy,
        createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
        updatedAt: r.updatedAt instanceof Date ? r.updatedAt.toISOString() : r.updatedAt,
      })),
      totalsByCategory,
      grandTotal,
    })
  } catch (err) {
    console.error('[platform-analytics/costs GET] error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Costs query failed' },
      { status: 500 },
    )
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  if (!validateCsrfToken(req)) {
    return NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const month = typeof body?.month === 'string' ? parseMonth(body.month) : null
  if (!month) {
    return NextResponse.json({ error: 'month required (YYYY-MM)' }, { status: 400 })
  }
  if (!body?.category || !isValidCostCategory(body.category)) {
    return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
  }
  const amount = Number(body?.amount)
  if (!Number.isFinite(amount) || amount < 0 || !Number.isInteger(amount)) {
    return NextResponse.json({ error: 'amount must be a non-negative integer (paise)' }, { status: 400 })
  }
  const description = typeof body?.description === 'string' ? body.description.slice(0, 500) : null
  const isRecurring = body?.isRecurring !== false // default true
  const currency = typeof body?.currency === 'string' ? body.currency.slice(0, 3).toUpperCase() : 'INR'

  try {
    const row = await addCost({
      month: month.toISOString().slice(0, 10),
      category: body.category,
      description,
      amount,
      currency,
      isRecurring,
      enteredBy: auth.userId,
    })
    return NextResponse.json({ ok: true, cost: row }, { status: 201 })
  } catch (err) {
    console.error('[platform-analytics/costs POST] error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to add cost' },
      { status: 500 },
    )
  }
}
