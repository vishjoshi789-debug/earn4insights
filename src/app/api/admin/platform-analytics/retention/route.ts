import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '../_auth'
import { getRetentionCohorts } from '@/db/repositories/platformAnalyticsRepository'
import type { RetentionData, UserRole } from '@/lib/types/platformAnalytics'

/**
 * GET /api/admin/platform-analytics/retention?role=all|brand|consumer|influencer
 *
 * Returns up to 12 most-recent weekly cohorts for the selected role,
 * plus aggregate averages for day_1 / day_7 / day_30. Empty cohorts
 * (recent ones where day_N hasn't matured) return null for that cell —
 * the heatmap renders these as a muted "—" instead of 0%.
 */

const VALID_ROLES: UserRole[] = ['all', 'brand', 'consumer', 'influencer']

export async function GET(req: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const roleParam = (req.nextUrl.searchParams.get('role') ?? 'all') as UserRole
  const role: UserRole = VALID_ROLES.includes(roleParam) ? roleParam : 'all'

  try {
    const rows = await getRetentionCohorts(role, 'weekly', 12)
    const num = (v: unknown): number | null => (v == null ? null : Number(v))
    const cohorts = rows.map((r) => ({
      cohortDate: typeof r.cohortDate === 'string' ? r.cohortDate : new Date(r.cohortDate).toISOString().slice(0, 10),
      cohortSize: r.cohortSize,
      day1: num(r.day1),
      day7: num(r.day7),
      day14: num(r.day14),
      day30: num(r.day30),
      day60: num(r.day60),
      day90: num(r.day90),
    }))
    const avg = (xs: Array<number | null>): number | null => {
      const v = xs.filter((x): x is number => x != null)
      return v.length === 0 ? null : Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 100) / 100
    }
    const payload: RetentionData = {
      role,
      cohorts,
      avgDay1: avg(cohorts.map((c) => c.day1)),
      avgDay7: avg(cohorts.map((c) => c.day7)),
      avgDay30: avg(cohorts.map((c) => c.day30)),
    }
    return NextResponse.json(payload)
  } catch (err) {
    console.error('[platform-analytics/retention] error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Retention query failed' },
      { status: 500 },
    )
  }
}
