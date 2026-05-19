import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '../_auth'
import { computeGrowthPrediction } from '@/server/platformAnalyticsService'

/**
 * GET /api/admin/platform-analytics/predictions?metric=users|revenue&days=30|60|90
 *
 * OLS linear regression on the last 30 days of daily metrics.
 * Returns combined historical + forecast series with ±1.96σ
 * prediction-interval bands. Trend bucketed as improving / stable /
 * declining based on slope normalised by mean.
 */

const VALID_METRICS = new Set(['users', 'revenue'])
const VALID_DAYS = new Set(['30', '60', '90'])

export async function GET(req: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const metric = req.nextUrl.searchParams.get('metric') ?? 'users'
  const daysRaw = req.nextUrl.searchParams.get('days') ?? '30'
  if (!VALID_METRICS.has(metric)) {
    return NextResponse.json({ error: 'Invalid metric. Use users or revenue.' }, { status: 400 })
  }
  const days = VALID_DAYS.has(daysRaw) ? Number(daysRaw) : 30

  try {
    const prediction = await computeGrowthPrediction(metric as 'users' | 'revenue', days)
    return NextResponse.json(prediction)
  } catch (err) {
    console.error('[platform-analytics/predictions] error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Prediction query failed' },
      { status: 500 },
    )
  }
}
