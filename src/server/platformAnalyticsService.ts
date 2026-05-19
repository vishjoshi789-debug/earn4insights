import 'server-only'

/**
 * Platform Analytics Service — Founder Dashboard
 *
 * Layer rules:
 *   - This service is the ONLY place that turns raw DB queries into the
 *     dashboard payload shape consumed by /api/admin/platform-analytics.
 *   - Repos handle DB; API routes handle auth + rate limiting.
 *   - All money fields are paise. All percentages are 0–100 floats.
 *
 * Side-effects (the compute* functions): each upserts one row using the
 * UNIQUE keys defined in migration 017, so re-running the cron for the
 * same date / month is idempotent — required because the cron can be
 * retried by Vercel / cron-job.org and the manual backfill helper.
 */

import { pgClient } from '@/db'
import {
  upsertDailyMetrics,
  upsertRevenueMetrics,
  upsertRetentionCohort,
  upsertFinancialSnapshot,
  getDailyMetrics,
  getRevenueMetrics,
  getRetentionCohorts,
  getCosts,
  getCostsForMonthRange,
  getFinancialSnapshot,
  getFinancialSnapshots,
  getLatestDailyMetric,
  getUserCountSnapshot,
  getNewUserCount,
  getActiveUserCount,
  getDailyActiveByRole,
  getDailyEngagement,
  getPaymentMetrics,
  getFeatureUsage,
  buildCohortRetention,
  type DateRange,
} from '@/db/repositories/platformAnalyticsRepository'
import type {
  CostCategory,
  DashboardPayload,
  EngagementBlock,
  FinancialBlock,
  HealthBand,
  HealthScore,
  HealthScoreFactor,
  HealthTrend,
  Overview,
  Prediction,
  PredictionTrend,
  RetentionData,
  RevenueBlock,
  SupportSnapshot,
  TimeRange,
  UserGrowth,
  UserRole,
} from '@/lib/types/platformAnalytics'
import { COST_CATEGORIES } from '@/lib/types/platformAnalytics'

// ════════════════════════════════════════════════════════════════
// DATE HELPERS
// ════════════════════════════════════════════════════════════════

const MS_PER_DAY = 24 * 60 * 60 * 1000

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * MS_PER_DAY)
}

function startOfUtcMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
}

function addMonths(d: Date, n: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1))
}

function rangeForTimeWindow(range: TimeRange, now = new Date()): DateRange {
  const to = startOfUtcDay(addDays(now, 1)) // exclusive — covers today
  if (range === '7d') return { from: addDays(to, -7), to }
  if (range === '30d') return { from: addDays(to, -30), to }
  if (range === '90d') return { from: addDays(to, -90), to }
  if (range === '12m') return { from: addMonths(to, -12), to }
  // 'all' — cap at 5 years to keep queries bounded; raise if needed.
  return { from: addMonths(to, -60), to }
}

function pctChange(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : 100
  return Math.round(((current - previous) / Math.abs(previous)) * 10000) / 100
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x))
}

// Defensive wrapper — single failing sub-block returns its fallback instead
// of sinking the whole dashboard. Same pattern as support/analytics.
async function safely<T>(label: string, run: () => Promise<T>, fallback: T, errors: string[]): Promise<T> {
  try {
    return await run()
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    errors.push(`${label}: ${msg}`)
    console.error(`[platformAnalytics] ${label} failed:`, err)
    return fallback
  }
}

// ════════════════════════════════════════════════════════════════
// 1. computeDailyMetrics — one row of platform_metrics_daily
// ════════════════════════════════════════════════════════════════

export async function computeDailyMetrics(date: Date) {
  const day = startOfUtcDay(date)
  const dayEnd = addDays(day, 1)

  const [snap, newCounts, dau, wau, mau, byRole, eng] = await Promise.all([
    getUserCountSnapshot(dayEnd),
    getNewUserCount({ from: day, to: dayEnd }),
    getActiveUserCount(day, dayEnd),
    getActiveUserCount(addDays(day, -6), dayEnd),
    getActiveUserCount(addDays(day, -29), dayEnd),
    getDailyActiveByRole({ from: day, to: dayEnd }),
    getDailyEngagement({ from: day, to: dayEnd }),
  ])

  const role = byRole[0] ?? { date: '', dau: 0, brandDau: 0, consumerDau: 0, influencerDau: 0 }

  return upsertDailyMetrics(day, {
    totalUsers: snap.totalUsers,
    totalBrands: snap.totalBrands,
    totalConsumers: snap.totalConsumers,
    totalInfluencers: snap.totalInfluencers,
    newUsers: newCounts.newUsers,
    newBrands: newCounts.newBrands,
    newConsumers: newCounts.newConsumers,
    newInfluencers: newCounts.newInfluencers,
    dau,
    wau,
    mau,
    brandDau: role.brandDau,
    consumerDau: role.consumerDau,
    influencerDau: role.influencerDau,
    feedbackCount: eng.feedbackCount,
    surveyResponses: eng.surveyResponses,
    dealsRedeemed: eng.dealsRedeemed,
    communityPosts: eng.communityPosts,
    communityComments: eng.communityComments,
    campaignsCreated: eng.campaignsCreated,
    campaignsCompleted: eng.campaignsCompleted,
    chatConversations: eng.chatConversations,
    chatResolvedByAi: eng.chatResolvedByAi,
    supportTickets: eng.supportTickets,
  })
}

// ════════════════════════════════════════════════════════════════
// 2. computeRevenueMetrics — one row of revenue_metrics_daily
// ════════════════════════════════════════════════════════════════

export async function computeRevenueMetrics(date: Date) {
  const day = startOfUtcDay(date)
  const dayEnd = addDays(day, 1)
  const pay = await getPaymentMetrics({ from: day, to: dayEnd })
  const netRevenue = pay.platformFees - pay.refunds
  return upsertRevenueMetrics(day, {
    grossRevenue: pay.grossRevenue,
    platformFees: pay.platformFees,
    influencerPayouts: pay.influencerPayouts,
    consumerRewardsRedeemed: pay.consumerRewardsRedeemed,
    refunds: pay.refunds,
    netRevenue,
    paymentCount: pay.paymentCount,
    paymentSuccessCount: pay.paymentSuccessCount,
    paymentFailedCount: pay.paymentFailedCount,
    avgPaymentAmount: pay.avgPaymentAmount,
    currency: 'INR',
  })
}

// ════════════════════════════════════════════════════════════════
// 3. computeRetentionCohorts — refresh weekly
// ════════════════════════════════════════════════════════════════

export async function computeRetentionCohorts(weeksBack = 12) {
  const roles: UserRole[] = ['all', 'brand', 'consumer', 'influencer']
  const stats = { rolesProcessed: 0, rowsUpserted: 0 }
  for (const role of roles) {
    const rows = await buildCohortRetention(weeksBack, role)
    for (const row of rows) {
      await upsertRetentionCohort({
        cohortDate: row.cohortDate,
        cohortSize: row.cohortSize,
        role,
        periodType: 'weekly',
        // decimal columns accept string in Drizzle
        day1: row.day1 != null ? String(row.day1) : null,
        day7: row.day7 != null ? String(row.day7) : null,
        day14: row.day14 != null ? String(row.day14) : null,
        day30: row.day30 != null ? String(row.day30) : null,
        day60: row.day60 != null ? String(row.day60) : null,
        day90: row.day90 != null ? String(row.day90) : null,
      })
      stats.rowsUpserted += 1
    }
    stats.rolesProcessed += 1
  }
  return stats
}

// ════════════════════════════════════════════════════════════════
// 4. computeFinancialSnapshot — one row of financial_snapshots_monthly
// ════════════════════════════════════════════════════════════════

/**
 * MRR proxy: marketplace platform fees are billed per-campaign, not per-month
 * subscription. We define MRR = sum of netRevenue for the calendar month —
 * imperfect but the closest signal we have without a true subscription product.
 * Documented in CLAUDE.md key decisions.
 */
export async function computeFinancialSnapshot(month: Date, opts?: { cashBalance?: number }) {
  const monthStart = startOfUtcMonth(month)
  const monthEnd = addMonths(monthStart, 1)
  const prevMonthStart = addMonths(monthStart, -1)

  // Aggregate this month + last month from the daily rollups in one call each.
  const [thisMonthRows, lastMonthRows, costRows] = await Promise.all([
    getRevenueMetrics({ from: monthStart, to: monthEnd }),
    getRevenueMetrics({ from: prevMonthStart, to: monthStart }),
    getCosts(monthStart),
  ])

  const sum = (rows: typeof thisMonthRows, k: keyof (typeof thisMonthRows)[number]) =>
    rows.reduce((acc, r) => acc + Number(r[k] ?? 0), 0)

  const grossRevenue = sum(thisMonthRows, 'grossRevenue')
  const platformFees = sum(thisMonthRows, 'platformFees')
  const influencerPayouts = sum(thisMonthRows, 'influencerPayouts')
  const consumerRewards = sum(thisMonthRows, 'consumerRewardsRedeemed')
  const refunds = sum(thisMonthRows, 'refunds')
  const netRevenue = sum(thisMonthRows, 'netRevenue')
  const lastMonthNet = sum(lastMonthRows, 'netRevenue')

  // Cost breakdown by category (paise)
  const costBreakdown: Record<string, number> = {}
  for (const cat of COST_CATEGORIES) costBreakdown[cat] = 0
  for (const c of costRows) {
    costBreakdown[c.category] = (costBreakdown[c.category] ?? 0) + Number(c.amount)
  }
  const totalCosts = costRows.reduce((acc, c) => acc + Number(c.amount), 0)

  // Margin
  const grossMargin = netRevenue - totalCosts
  const grossMarginPercent = netRevenue === 0 ? 0 : Math.round((grossMargin / netRevenue) * 10000) / 100

  // Cash / runway
  const existing = await getFinancialSnapshot(monthStart)
  const cashBalance = opts?.cashBalance ?? Number(existing?.cashBalance ?? 0)
  const burnRate = totalCosts - netRevenue
  // runway in months. null = net positive (or insufficient signal).
  const runwayMonths =
    burnRate > 0 && cashBalance > 0
      ? Math.round((cashBalance / burnRate) * 10) / 10
      : null

  // MRR (proxy = monthly net revenue) + growth
  const mrr = netRevenue
  const mrrGrowthPercent = pctChange(mrr, lastMonthNet)

  // ARPU + LTV — single round-trip
  // Dates → ISO strings before SQL interpolation (postgres.js can throw
  // "The string argument must be of type string. Received an instance of
  // Date" when Date objects hit certain encoder code paths).
  const monthStartIso = monthStart.toISOString()
  const monthEndIso = monthEnd.toISOString()
  const [{ active_brands, brand_ltv, consumer_ltv }] = await pgClient<{
    active_brands: string
    brand_ltv: string
    consumer_ltv: string
  }[]>`
    SELECT
      -- distinct brands with at least one campaign payment this month
      (SELECT COUNT(DISTINCT ic.brand_id)::text
       FROM campaign_payments cp
       JOIN influencer_campaigns ic ON ic.id = cp.campaign_id
       WHERE cp.status IN ('escrowed','released')
         AND cp.created_at >= ${monthStartIso} AND cp.created_at < ${monthEndIso}
      ) AS active_brands,
      -- avg lifetime platform fees per brand (rough brand LTV in paise)
      COALESCE((
        SELECT AVG(per_brand)::text
        FROM (
          SELECT ic.brand_id, SUM(cp.platform_fee) AS per_brand
          FROM campaign_payments cp
          JOIN influencer_campaigns ic ON ic.id = cp.campaign_id
          WHERE cp.status IN ('escrowed','released')
          GROUP BY ic.brand_id
        ) t
      ), '0') AS brand_ltv,
      -- avg lifetime payout (points × 10 paise/point) per consumer
      COALESCE((
        SELECT (AVG(per_consumer) * 10)::text
        FROM (
          SELECT user_id, SUM(points_spent) AS per_consumer
          FROM reward_redemptions
          WHERE status = 'fulfilled'
          GROUP BY user_id
        ) t
      ), '0') AS consumer_ltv
  `

  const activeBrandsN = Number(active_brands || 0)
  const arpu = activeBrandsN > 0 ? Math.round(netRevenue / activeBrandsN) : 0
  const brandLtv = Math.round(Number(brand_ltv || 0))
  const consumerLtv = Math.round(Number(consumer_ltv || 0))

  return upsertFinancialSnapshot({
    month: monthStart.toISOString().slice(0, 10),
    grossRevenue,
    platformFees,
    influencerPayouts,
    consumerRewards,
    refunds,
    netRevenue,
    totalCosts,
    costBreakdown,
    grossMargin,
    grossMarginPercent: String(grossMarginPercent),
    cashBalance,
    burnRate,
    runwayMonths: runwayMonths != null ? String(runwayMonths) : null,
    mrr,
    mrrGrowthPercent: String(mrrGrowthPercent),
    arpu,
    brandLtv,
    consumerLtv,
  })
}

// ════════════════════════════════════════════════════════════════
// 5. getDashboardData — the orchestrator
// ════════════════════════════════════════════════════════════════

export async function getDashboardData(range: TimeRange): Promise<DashboardPayload> {
  const errors: string[] = []
  const now = new Date()
  const window = rangeForTimeWindow(range, now)
  const prevWindow: DateRange = {
    from: new Date(window.from.getTime() - (window.to.getTime() - window.from.getTime())),
    to: window.from,
  }

  // Daily metrics for the window — backs userGrowth + sparklines
  const dailyMetrics = await safely('daily_metrics', () => getDailyMetrics(window), [], errors)
  const prevDailyMetrics = await safely('prev_daily_metrics', () => getDailyMetrics(prevWindow), [], errors)
  const latestDaily = await safely('latest_daily', () => getLatestDailyMetric(), null, errors)

  // Revenue
  const revenueRows = await safely('revenue_daily', () => getRevenueMetrics(window), [], errors)
  const prevRevenueRows = await safely('prev_revenue_daily', () => getRevenueMetrics(prevWindow), [], errors)

  // Retention (default = 'all', UI changes role via /retention route)
  const retentionRows = await safely(
    'retention',
    () => getRetentionCohorts('all', 'weekly', 12),
    [],
    errors,
  )

  // Financial snapshots (last 12 months for cumulative chart + headline metrics)
  const financialRows = await safely(
    'financial_snapshots',
    () => getFinancialSnapshots({ from: addMonths(startOfUtcMonth(now), -11), to: addMonths(startOfUtcMonth(now), 1) }),
    [],
    errors,
  )
  const thisMonthSnapshot = await safely(
    'financial_this_month',
    () => getFinancialSnapshot(startOfUtcMonth(now)),
    null,
    errors,
  )

  // Costs for the current month — drives breakdown donut
  const currentMonthCosts = await safely('current_month_costs', () => getCosts(startOfUtcMonth(now)), [], errors)

  // Feature usage
  const featureUsage = await safely('feature_usage', () => getFeatureUsage(window), [], errors)

  // Support snapshot
  const support = await safely('support_snapshot', () => getSupportSnapshot(), {
    openTickets: 0, aiResolutionRatePct: 0, avgFirstResponseHours: null, satisfactionAvg: null,
  } as SupportSnapshot, errors)

  // ── Assemble blocks ────────────────────────────────────────────

  const overview = buildOverview(latestDaily, dailyMetrics, prevDailyMetrics)
  const userGrowth = buildUserGrowth(dailyMetrics)
  const retention: RetentionData = {
    role: 'all',
    cohorts: retentionRows.map((r) => ({
      cohortDate: typeof r.cohortDate === 'string' ? r.cohortDate : new Date(r.cohortDate).toISOString().slice(0, 10),
      cohortSize: r.cohortSize,
      day1: r.day1 != null ? Number(r.day1) : null,
      day7: r.day7 != null ? Number(r.day7) : null,
      day14: r.day14 != null ? Number(r.day14) : null,
      day30: r.day30 != null ? Number(r.day30) : null,
      day60: r.day60 != null ? Number(r.day60) : null,
      day90: r.day90 != null ? Number(r.day90) : null,
    })),
    avgDay1: avgNullable(retentionRows.map((r) => (r.day1 != null ? Number(r.day1) : null))),
    avgDay7: avgNullable(retentionRows.map((r) => (r.day7 != null ? Number(r.day7) : null))),
    avgDay30: avgNullable(retentionRows.map((r) => (r.day30 != null ? Number(r.day30) : null))),
  }
  const revenue = buildRevenue(revenueRows, prevRevenueRows, thisMonthSnapshot)
  const engagement = buildEngagement(dailyMetrics, prevDailyMetrics, featureUsage, latestDaily)
  const financial = buildFinancial(financialRows, thisMonthSnapshot, currentMonthCosts)

  // Predictions — best-effort, may return flat-line if no signal
  const userPrediction = await safely(
    'prediction_users',
    () => computeGrowthPrediction('users', 30, dailyMetrics),
    flatPrediction('users'),
    errors,
  )
  const revenuePrediction = await safely(
    'prediction_revenue',
    () => computeGrowthPrediction('revenue', 30, dailyMetrics, revenueRows),
    flatPrediction('revenue'),
    errors,
  )

  const health = await safely(
    'health_score',
    () => computeHealthScore(),
    {
      score: 0, band: 'critical' as HealthBand, trend: 'stable' as HealthTrend,
      trendDeltaPct: 0, factors: [], computedAt: new Date().toISOString(),
    } as HealthScore,
    errors,
  )

  return {
    range,
    computedAt: new Date().toISOString(),
    health,
    overview,
    userGrowth,
    retention,
    revenue,
    engagement,
    financial,
    predictions: { users: userPrediction, revenue: revenuePrediction },
    support,
    _errors: errors.length > 0 ? errors : undefined,
  }
}

// ── Sub-block builders ──────────────────────────────────────────

function buildOverview(
  latest: Awaited<ReturnType<typeof getLatestDailyMetric>>,
  daily: Awaited<ReturnType<typeof getDailyMetrics>>,
  prevDaily: Awaited<ReturnType<typeof getDailyMetrics>>,
): Overview {
  const newUsersInRange = daily.reduce((acc, r) => acc + r.newUsers, 0)
  const prevNewUsers = prevDaily.reduce((acc, r) => acc + r.newUsers, 0)
  const totalUsers = latest?.totalUsers ?? 0
  const dau = latest?.dau ?? 0
  const mau = latest?.mau ?? 0
  return {
    totalUsers,
    dau,
    mau,
    dauMauRatio: mau === 0 ? 0 : Math.round((dau / mau) * 100) / 100,
    newUsersInRange,
    growthRatePct: pctChange(newUsersInRange, prevNewUsers),
    stakeholders: {
      brands: latest?.totalBrands ?? 0,
      consumers: latest?.totalConsumers ?? 0,
      influencers: latest?.totalInfluencers ?? 0,
    },
  }
}

function buildUserGrowth(daily: Awaited<ReturnType<typeof getDailyMetrics>>): UserGrowth {
  const series = daily.map((r) => ({
    date: typeof r.date === 'string' ? r.date : new Date(r.date).toISOString().slice(0, 10),
    total: r.totalUsers,
    brands: r.totalBrands,
    consumers: r.totalConsumers,
    influencers: r.totalInfluencers,
    newUsers: r.newUsers,
  }))
  const wow = windowedPctChange(daily, 7, (r) => r.newUsers)
  const mom = windowedPctChange(daily, 30, (r) => r.newUsers)
  const qoq = windowedPctChange(daily, 90, (r) => r.newUsers)
  return { series, wowPct: wow, momPct: mom, qoqPct: qoq }
}

function windowedPctChange<T>(rows: T[], windowDays: number, pick: (r: T) => number): number {
  if (rows.length < windowDays * 2) {
    const sum = rows.slice(-windowDays).reduce((a, r) => a + pick(r), 0)
    return sum === 0 ? 0 : 0
  }
  const recent = rows.slice(-windowDays).reduce((a, r) => a + pick(r), 0)
  const prior = rows.slice(-windowDays * 2, -windowDays).reduce((a, r) => a + pick(r), 0)
  return pctChange(recent, prior)
}

function buildRevenue(
  rows: Awaited<ReturnType<typeof getRevenueMetrics>>,
  prevRows: Awaited<ReturnType<typeof getRevenueMetrics>>,
  thisMonthSnapshot: Awaited<ReturnType<typeof getFinancialSnapshot>>,
): RevenueBlock {
  const series = rows.map((r) => ({
    date: typeof r.date === 'string' ? r.date : new Date(r.date).toISOString().slice(0, 10),
    gross: r.grossRevenue,
    fees: r.platformFees,
    net: r.netRevenue,
    refunds: r.refunds,
    payments: r.paymentCount,
  }))
  const totalGross = rows.reduce((a, r) => a + r.grossRevenue, 0)
  const totalFees = rows.reduce((a, r) => a + r.platformFees, 0)
  const totalNet = rows.reduce((a, r) => a + r.netRevenue, 0)
  const totalRefunds = rows.reduce((a, r) => a + r.refunds, 0)
  const totalCount = rows.reduce((a, r) => a + r.paymentCount, 0)
  const successCount = rows.reduce((a, r) => a + r.paymentSuccessCount, 0)
  const failedCount = rows.reduce((a, r) => a + r.paymentFailedCount, 0)
  const avgAmt = totalCount > 0 ? Math.round(rows.reduce((a, r) => a + r.avgPaymentAmount * r.paymentCount, 0) / totalCount) : 0
  return {
    totalGross,
    totalFees,
    totalNet,
    totalRefunds,
    mrr: thisMonthSnapshot?.mrr ?? 0,
    mrrGrowthPct: Number(thisMonthSnapshot?.mrrGrowthPercent ?? 0),
    series,
    payments: {
      totalCount,
      successCount,
      failedCount,
      successRatePct: totalCount === 0 ? 0 : Math.round((successCount / totalCount) * 10000) / 100,
      avgAmount: avgAmt,
    },
  }
}

function buildEngagement(
  daily: Awaited<ReturnType<typeof getDailyMetrics>>,
  prevDaily: Awaited<ReturnType<typeof getDailyMetrics>>,
  featureUsage: Awaited<ReturnType<typeof getFeatureUsage>>,
  latest: Awaited<ReturnType<typeof getLatestDailyMetric>>,
): EngagementBlock {
  const ser = (pick: (r: (typeof daily)[number]) => number) =>
    daily.map((r) => ({
      date: typeof r.date === 'string' ? r.date : new Date(r.date).toISOString().slice(0, 10),
      count: pick(r),
    }))
  const tot = (pick: (r: (typeof daily)[number]) => number) => daily.reduce((a, r) => a + pick(r), 0)
  const totPrev = (pick: (r: (typeof daily)[number]) => number) => prevDaily.reduce((a, r) => a + pick(r), 0)

  const totals = {
    feedback: tot((r) => r.feedbackCount),
    surveys: tot((r) => r.surveyResponses),
    deals: tot((r) => r.dealsRedeemed),
    posts: tot((r) => r.communityPosts),
    comments: tot((r) => r.communityComments),
  }

  // Denominator for feature adoption = active users per role in the window (Q3 recommendation).
  const denom = {
    brand: latest?.brandDau ?? 0,
    consumer: latest?.consumerDau ?? 0,
    influencer: latest?.influencerDau ?? 0,
  }
  const features = featureUsage.map((f) => ({
    feature: f.feature,
    brandPct: denom.brand > 0 ? Math.round((f.brandUsers / denom.brand) * 10000) / 100 : null,
    consumerPct: denom.consumer > 0 ? Math.round((f.consumerUsers / denom.consumer) * 10000) / 100 : null,
    influencerPct: denom.influencer > 0 ? Math.round((f.influencerUsers / denom.influencer) * 10000) / 100 : null,
  }))

  const chatConversations = tot((r) => r.chatConversations)
  const chatResolved = tot((r) => r.chatResolvedByAi)

  return {
    feedback: { series: ser((r) => r.feedbackCount), total: totals.feedback, pctChange: pctChange(totals.feedback, totPrev((r) => r.feedbackCount)) },
    surveys: { series: ser((r) => r.surveyResponses), total: totals.surveys, pctChange: pctChange(totals.surveys, totPrev((r) => r.surveyResponses)) },
    deals: { series: ser((r) => r.dealsRedeemed), total: totals.deals, pctChange: pctChange(totals.deals, totPrev((r) => r.dealsRedeemed)) },
    community: {
      series: daily.map((r) => ({
        date: typeof r.date === 'string' ? r.date : new Date(r.date).toISOString().slice(0, 10),
        posts: r.communityPosts,
        comments: r.communityComments,
      })),
      totalPosts: totals.posts,
      totalComments: totals.comments,
      pctChange: pctChange(
        totals.posts + totals.comments,
        totPrev((r) => r.communityPosts + r.communityComments),
      ),
    },
    features,
    chat: {
      conversations: chatConversations,
      resolvedByAi: chatResolved,
      resolutionRatePct: chatConversations === 0 ? 0 : Math.round((chatResolved / chatConversations) * 10000) / 100,
    },
  }
}

function buildFinancial(
  snapshots: Awaited<ReturnType<typeof getFinancialSnapshots>>,
  thisMonth: Awaited<ReturnType<typeof getFinancialSnapshot>>,
  costs: Awaited<ReturnType<typeof getCosts>>,
): FinancialBlock {
  // Net margin = (netRevenue - costs) / netRevenue; same as gross_margin_percent in our snapshot today.
  const grossMarginPct = Number(thisMonth?.grossMarginPercent ?? 0)
  const netMarginPct = grossMarginPct // we only track one margin layer

  const breakdownMap = new Map<CostCategory, number>()
  for (const cat of COST_CATEGORIES) breakdownMap.set(cat, 0)
  for (const c of costs) breakdownMap.set(c.category as CostCategory, (breakdownMap.get(c.category as CostCategory) ?? 0) + Number(c.amount))
  const costBreakdown = Array.from(breakdownMap.entries())
    .filter(([, amt]) => amt > 0)
    .map(([category, amount]) => ({ category, amount }))
  const totalCosts = costBreakdown.reduce((a, r) => a + r.amount, 0)

  const cumulative = snapshots.map((s) => ({
    month: typeof s.month === 'string' ? s.month : new Date(s.month).toISOString().slice(0, 10),
    revenue: s.netRevenue,
    costs: s.totalCosts,
  }))

  return {
    grossMarginPct,
    netMarginPct,
    burnRate: thisMonth?.burnRate ?? 0,
    runwayMonths: thisMonth?.runwayMonths != null ? Number(thisMonth.runwayMonths) : null,
    cashBalance: thisMonth?.cashBalance ?? 0,
    costBreakdown,
    totalCosts,
    ltv: {
      brand: thisMonth?.brandLtv ?? 0,
      consumer: thisMonth?.consumerLtv ?? 0,
    },
    arpu: thisMonth?.arpu ?? 0,
    cumulative,
  }
}

async function getSupportSnapshot(): Promise<SupportSnapshot> {
  const [{ open_tickets, ai_resolution_rate, avg_response_hours, satisfaction_avg }] = await pgClient<{
    open_tickets: string
    ai_resolution_rate: string | null
    avg_response_hours: string | null
    satisfaction_avg: string | null
  }[]>`
    SELECT
      (SELECT COUNT(*)::text FROM support_tickets WHERE status IN ('open','in_progress','waiting_on_user')) AS open_tickets,
      (SELECT
         CASE WHEN COUNT(*) = 0 THEN '0'
         ELSE (SUM(CASE WHEN resolved_by_ai = true THEN 1 ELSE 0 END)::numeric / COUNT(*) * 100)::text END
       FROM chat_conversations
       WHERE created_at >= NOW() - INTERVAL '30 days'
      ) AS ai_resolution_rate,
      (SELECT (AVG(EXTRACT(EPOCH FROM (fr.first_admin_at - t.created_at)) * 1000)::numeric / 3600000)::text
       FROM support_tickets t
       JOIN LATERAL (
         SELECT MIN(m.created_at) AS first_admin_at
         FROM support_ticket_messages m
         WHERE m.ticket_id = t.id
           AND m.sender_type IN ('admin', 'ai')
           AND m.is_internal_note = false
       ) fr ON fr.first_admin_at IS NOT NULL
       WHERE t.created_at >= NOW() - INTERVAL '30 days'
      ) AS avg_response_hours,
      (SELECT AVG(satisfaction_rating)::text
       FROM support_tickets
       WHERE satisfaction_rating IS NOT NULL
         AND created_at >= NOW() - INTERVAL '30 days'
      ) AS satisfaction_avg
  `
  return {
    openTickets: Number(open_tickets || 0),
    aiResolutionRatePct: Math.round(Number(ai_resolution_rate || 0) * 100) / 100,
    avgFirstResponseHours: avg_response_hours != null ? Math.round(Number(avg_response_hours) * 100) / 100 : null,
    satisfactionAvg: satisfaction_avg != null ? Math.round(Number(satisfaction_avg) * 100) / 100 : null,
  }
}

function avgNullable(xs: Array<number | null>): number | null {
  const vals = xs.filter((x): x is number => x != null)
  if (vals.length === 0) return null
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100
}

// ════════════════════════════════════════════════════════════════
// 6. computeHealthScore — single 0–100 with band + trend
// ════════════════════════════════════════════════════════════════

const HEALTH_WEIGHTS = {
  dau_mau: 0.20,
  retention_d7: 0.20,
  user_growth: 0.15,
  revenue_growth: 0.15,
  engagement: 0.15,
  support_csat: 0.15,
} as const

function bandFromScore(score: number): HealthBand {
  if (score >= 70) return 'healthy'
  if (score >= 40) return 'attention'
  return 'critical'
}

export async function computeHealthScore(): Promise<HealthScore> {
  const errors: string[] = []
  const factors = await rawHealthFactors(errors)
  const score = Math.round(
    factors.reduce((acc, f) => acc + f.contribution, 0),
  )

  // Trend — compare with score from ~7 days ago, recomputed against
  // historical data. Not stored; cheap to recompute since we only
  // touch already-aggregated tables.
  const trendDeltaPct = await safely(
    'health_trend',
    async () => {
      const priorFactors = await rawHealthFactors([], 7)
      const priorScore = priorFactors.reduce((acc, f) => acc + f.contribution, 0)
      return pctChange(score, priorScore)
    },
    0,
    errors,
  )
  const trend: HealthTrend = trendDeltaPct > 2 ? 'improving' : trendDeltaPct < -2 ? 'declining' : 'stable'

  return {
    score,
    band: bandFromScore(score),
    trend,
    trendDeltaPct,
    factors,
    computedAt: new Date().toISOString(),
  }
}

async function rawHealthFactors(errors: string[], daysAgo = 0): Promise<HealthScoreFactor[]> {
  const asOf = addDays(startOfUtcDay(new Date()), -daysAgo)
  const asOfEnd = addDays(asOf, 1)

  // Helpers
  const safe = <T>(label: string, run: () => Promise<T>, fallback: T) =>
    safely(label, run, fallback, errors)

  const latest = await safe('hs_latest_daily', () => getLatestDailyMetric(), null)
  const dau = latest?.dau ?? 0
  const mau = latest?.mau ?? 1
  const dauMauRatio = dau / mau
  const dauMauScore = clamp(dauMauRatio * 250, 0, 100) // 0.4 ratio = 100

  // Retention day-7 = avg across last 8 mature weekly cohorts
  const cohorts = await safe('hs_cohorts', () => getRetentionCohorts('all', 'weekly', 8), [])
  const d7Vals = cohorts.map((c) => (c.day7 != null ? Number(c.day7) : null)).filter((x): x is number => x != null)
  const day7Score = d7Vals.length === 0 ? 50 : clamp(d7Vals.reduce((a, b) => a + b, 0) / d7Vals.length, 0, 100)

  // MoM user growth & revenue growth — based on financial snapshot history
  const snapshots = await safe(
    'hs_snapshots',
    () => getFinancialSnapshots({ from: addMonths(startOfUtcMonth(asOf), -2), to: addMonths(startOfUtcMonth(asOf), 1) }),
    [],
  )
  const thisMonth = snapshots[snapshots.length - 1]
  const lastMonth = snapshots[snapshots.length - 2]
  const revGrowth = thisMonth && lastMonth ? Number(thisMonth.mrrGrowthPercent ?? 0) : 0
  const revGrowthScore = clamp((revGrowth + 20) * 2.5, 0, 100) // -20% → 0, +20% → 100

  const newUsersThisMonth = await safe('hs_new_users_this', () =>
    countNewUsers({ from: startOfUtcMonth(asOf), to: asOfEnd }), 0)
  const newUsersLastMonth = await safe('hs_new_users_last', () =>
    countNewUsers({ from: addMonths(startOfUtcMonth(asOf), -1), to: startOfUtcMonth(asOf) }), 0)
  const userGrowth = pctChange(newUsersThisMonth, newUsersLastMonth)
  const userGrowthScore = clamp((userGrowth + 20) * 2.5, 0, 100)

  // Engagement rate = avg engagement events per MAU in last 30 days, scaled
  const engagement30d = await safe('hs_eng_30d', () =>
    getDailyEngagement({ from: addDays(asOf, -29), to: asOfEnd }), {
      feedbackCount: 0, surveyResponses: 0, dealsRedeemed: 0, communityPosts: 0,
      communityComments: 0, campaignsCreated: 0, campaignsCompleted: 0,
      chatConversations: 0, chatResolvedByAi: 0, supportTickets: 0,
    })
  const totalEngagementEvents =
    engagement30d.feedbackCount + engagement30d.surveyResponses +
    engagement30d.dealsRedeemed + engagement30d.communityPosts +
    engagement30d.communityComments
  const eventsPerMau = mau === 0 ? 0 : totalEngagementEvents / mau
  const engagementScore = clamp(eventsPerMau * 25, 0, 100) // 4 events/MAU = 100

  // Support CSAT — avg satisfaction_rating / 5 * 100, null → 50 (neutral, no signal)
  const supportRows = await safe('hs_csat', async () => {
    const sinceIso = addDays(asOf, -29).toISOString()
    const untilIso = asOfEnd.toISOString()
    const [r] = await pgClient<{ avg_csat: string | null }[]>`
      SELECT AVG(satisfaction_rating)::text AS avg_csat
      FROM support_tickets
      WHERE satisfaction_rating IS NOT NULL
        AND created_at >= ${sinceIso}
        AND created_at < ${untilIso}
    `
    return r
  }, { avg_csat: null } as { avg_csat: string | null })
  const csatScore = supportRows?.avg_csat != null ? clamp(Number(supportRows.avg_csat) / 5 * 100, 0, 100) : 50

  const factors: HealthScoreFactor[] = [
    { key: 'dau_mau', label: 'DAU / MAU stickiness', weight: HEALTH_WEIGHTS.dau_mau, value: Math.round(dauMauScore), contribution: dauMauScore * HEALTH_WEIGHTS.dau_mau },
    { key: 'retention_d7', label: 'Day-7 retention', weight: HEALTH_WEIGHTS.retention_d7, value: Math.round(day7Score), contribution: day7Score * HEALTH_WEIGHTS.retention_d7 },
    { key: 'user_growth', label: 'MoM user growth', weight: HEALTH_WEIGHTS.user_growth, value: Math.round(userGrowthScore), contribution: userGrowthScore * HEALTH_WEIGHTS.user_growth },
    { key: 'revenue_growth', label: 'MoM revenue growth', weight: HEALTH_WEIGHTS.revenue_growth, value: Math.round(revGrowthScore), contribution: revGrowthScore * HEALTH_WEIGHTS.revenue_growth },
    { key: 'engagement', label: 'Engagement events / MAU', weight: HEALTH_WEIGHTS.engagement, value: Math.round(engagementScore), contribution: engagementScore * HEALTH_WEIGHTS.engagement },
    { key: 'support_csat', label: 'Support satisfaction', weight: HEALTH_WEIGHTS.support_csat, value: Math.round(csatScore), contribution: csatScore * HEALTH_WEIGHTS.support_csat },
  ]
  return factors
}

async function countNewUsers(range: DateRange): Promise<number> {
  const c = await getNewUserCount(range)
  return c.newUsers
}

// ════════════════════════════════════════════════════════════════
// 7. computeGrowthPrediction — OLS linear regression
// ════════════════════════════════════════════════════════════════

function flatPrediction(metric: 'users' | 'revenue'): Prediction {
  return {
    metric,
    series: [],
    trend: 'stable',
    slope: 0,
    expectedAtHorizonDays: { days: 30, value: 0 },
  }
}

/**
 * Simple OLS linear regression on the last 30 daily data points.
 * For 'users' the series is totalUsers; for 'revenue' it's netRevenue.
 *
 * Returns up to 60 points (30 historical + horizon forecast). Confidence
 * band = ±1.96σ of residuals (95% CI) — wide if the historical signal
 * is noisy, tight if linear.
 */
export async function computeGrowthPrediction(
  metric: 'users' | 'revenue',
  horizonDays: number,
  preFetchedDaily?: Awaited<ReturnType<typeof getDailyMetrics>>,
  preFetchedRevenue?: Awaited<ReturnType<typeof getRevenueMetrics>>,
): Promise<Prediction> {
  const now = new Date()
  const window: DateRange = { from: addDays(startOfUtcDay(now), -29), to: addDays(startOfUtcDay(now), 1) }

  let points: Array<{ date: string; value: number }>
  if (metric === 'users') {
    const rows = preFetchedDaily ?? (await getDailyMetrics(window))
    points = rows.map((r) => ({
      date: typeof r.date === 'string' ? r.date : new Date(r.date).toISOString().slice(0, 10),
      value: r.totalUsers,
    }))
  } else {
    const rows = preFetchedRevenue ?? (await getRevenueMetrics(window))
    points = rows.map((r) => ({
      date: typeof r.date === 'string' ? r.date : new Date(r.date).toISOString().slice(0, 10),
      value: r.netRevenue,
    }))
  }

  if (points.length < 5) return flatPrediction(metric)

  // OLS — x is day index 0..N-1, y is value
  const n = points.length
  const xs = points.map((_, i) => i)
  const ys = points.map((p) => p.value)
  const meanX = xs.reduce((a, b) => a + b, 0) / n
  const meanY = ys.reduce((a, b) => a + b, 0) / n
  let num = 0, den = 0
  for (let i = 0; i < n; i++) {
    num += (xs[i] - meanX) * (ys[i] - meanY)
    den += (xs[i] - meanX) ** 2
  }
  const slope = den === 0 ? 0 : num / den
  const intercept = meanY - slope * meanX

  // Residual standard deviation
  let ssRes = 0
  for (let i = 0; i < n; i++) {
    const yHat = slope * xs[i] + intercept
    ssRes += (ys[i] - yHat) ** 2
  }
  const sigma = Math.sqrt(ssRes / Math.max(1, n - 2))
  const z = 1.96

  // Historical series with actual values
  const series = points.map((p, i) => ({
    date: p.date,
    actual: p.value,
    predicted: null,
    confLow: null,
    confHigh: null,
  })) as Prediction['series']

  // Forecast tail
  const lastDate = new Date(points[points.length - 1].date)
  for (let h = 1; h <= horizonDays; h++) {
    const x = (n - 1) + h
    const yHat = Math.max(0, slope * x + intercept)
    const ci = z * sigma * Math.sqrt(1 + 1 / n + ((x - meanX) ** 2) / Math.max(1, den))
    series.push({
      date: addDays(lastDate, h).toISOString().slice(0, 10),
      actual: null,
      predicted: Math.round(yHat),
      confLow: Math.max(0, Math.round(yHat - ci)),
      confHigh: Math.round(yHat + ci),
    })
  }

  // Trend bucket — slope as a fraction of mean.
  const relSlope = meanY === 0 ? 0 : slope / Math.abs(meanY)
  const trend: PredictionTrend =
    relSlope > 0.005 ? 'improving' : relSlope < -0.005 ? 'declining' : 'stable'

  const horizonValue = Math.max(0, Math.round(slope * (n - 1 + horizonDays) + intercept))

  return {
    metric,
    series,
    trend,
    slope: Math.round(slope * 100) / 100,
    expectedAtHorizonDays: { days: horizonDays, value: horizonValue },
  }
}
