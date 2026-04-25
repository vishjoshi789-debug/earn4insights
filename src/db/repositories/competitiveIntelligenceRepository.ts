import 'server-only'

import { db } from '@/db'
import {
  competitorProfiles,
  competitorProducts,
  competitorPriceHistory,
  competitiveInsights,
  competitiveBenchmarks,
  competitiveScores,
  competitorAlerts,
  competitiveReports,
  competitorDigestPreferences,
  feedback,
  products,
  type NewCompetitorProfile,
  type NewCompetitorProduct,
  type NewCompetitorPriceHistory,
  type NewCompetitiveInsight,
  type NewCompetitiveBenchmark,
  type NewCompetitiveScore,
  type NewCompetitorAlert,
  type NewCompetitiveReport,
  type NewCompetitorDigestPreferences,
} from '@/db/schema'
import { eq, and, desc, gt, gte, inArray, isNull, isNotNull, or, sql as drizzleSql } from 'drizzle-orm'

// ═══════════════════════════════════════════════════════════════════════════
// PRIVACY CONTROLS
// ═══════════════════════════════════════════════════════════════════════════
//
// NON-NEGOTIABLE: Every aggregate function that reads consumer-level data
// MUST return null if the cohort has fewer than MIN_COHORT_SIZE rows.
// This is the re-identification floor. Services and API routes CANNOT
// bypass this — the chokepoint is here.
//
// Access to aggregates is logged (logAggregateAccess) to support audit
// trails for DPDP / GDPR compliance.

export const MIN_COHORT_SIZE = 5

function logAggregateAccess(
  brandId: string,
  func: string,
  cohortSize: number,
  allowed: boolean
) {
  // Lightweight structured log; parsed by Vercel log drains.
  console.log(
    JSON.stringify({
      event: 'competitive_intelligence.aggregate_access',
      brandId,
      func,
      cohortSize,
      allowed,
      minCohort: MIN_COHORT_SIZE,
      timestamp: new Date().toISOString(),
    })
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPETITOR PROFILES — CRUD
// ═══════════════════════════════════════════════════════════════════════════

export async function getCompetitorProfiles(
  brandId: string,
  filters?: { activeOnly?: boolean; confirmedOnly?: boolean; category?: string }
) {
  const conditions = [eq(competitorProfiles.brandId, brandId)]
  if (filters?.activeOnly) conditions.push(eq(competitorProfiles.isActive, true))
  if (filters?.confirmedOnly) conditions.push(eq(competitorProfiles.isConfirmed, true))
  if (filters?.category) conditions.push(eq(competitorProfiles.category, filters.category))

  return db
    .select()
    .from(competitorProfiles)
    .where(and(...conditions))
    .orderBy(desc(competitorProfiles.createdAt))
}

export async function getCompetitorById(id: string) {
  const [row] = await db
    .select()
    .from(competitorProfiles)
    .where(eq(competitorProfiles.id, id))
    .limit(1)
  return row ?? null
}

export async function createCompetitor(data: NewCompetitorProfile) {
  const [row] = await db.insert(competitorProfiles).values(data).returning()
  return row
}

export async function updateCompetitor(
  id: string,
  data: Partial<NewCompetitorProfile>
) {
  const [row] = await db
    .update(competitorProfiles)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(competitorProfiles.id, id))
    .returning()
  return row ?? null
}

export async function dismissCompetitor(id: string) {
  const [row] = await db
    .update(competitorProfiles)
    .set({
      isActive: false,
      dismissedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(competitorProfiles.id, id))
    .returning()
  return row ?? null
}

export async function getSuggestedCompetitors(brandId: string) {
  return db
    .select()
    .from(competitorProfiles)
    .where(
      and(
        eq(competitorProfiles.brandId, brandId),
        eq(competitorProfiles.isSystemSuggested, true),
        eq(competitorProfiles.isConfirmed, false),
        isNull(competitorProfiles.dismissedAt)
      )
    )
    .orderBy(desc(competitorProfiles.createdAt))
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPETITOR PRODUCTS + PRICE HISTORY
// ═══════════════════════════════════════════════════════════════════════════

export async function getCompetitorProducts(
  competitorProfileId: string,
  opts?: { activeOnly?: boolean }
) {
  const conditions = [eq(competitorProducts.competitorProfileId, competitorProfileId)]
  if (opts?.activeOnly) conditions.push(eq(competitorProducts.isActive, true))

  return db
    .select()
    .from(competitorProducts)
    .where(and(...conditions))
    .orderBy(desc(competitorProducts.updatedAt))
}

export async function createCompetitorProduct(data: NewCompetitorProduct) {
  const [row] = await db.insert(competitorProducts).values(data).returning()
  return row
}

export async function updateProductPrice(
  productId: string,
  price: number,
  currency: string,
  source: NewCompetitorPriceHistory['source']
) {
  await db
    .update(competitorProducts)
    .set({
      currentPrice: price,
      currency,
      priceUpdatedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(competitorProducts.id, productId))

  const [history] = await db
    .insert(competitorPriceHistory)
    .values({ competitorProductId: productId, price, currency, source })
    .returning()
  return history
}

export async function getPriceHistory(
  competitorProductId: string,
  opts?: { since?: Date; limit?: number }
) {
  const conditions = [eq(competitorPriceHistory.competitorProductId, competitorProductId)]
  if (opts?.since) conditions.push(gte(competitorPriceHistory.recordedAt, opts.since))

  return db
    .select()
    .from(competitorPriceHistory)
    .where(and(...conditions))
    .orderBy(desc(competitorPriceHistory.recordedAt))
    .limit(opts?.limit ?? 100)
}

// ═══════════════════════════════════════════════════════════════════════════
// INSIGHTS
// ═══════════════════════════════════════════════════════════════════════════

export async function getInsights(
  brandId: string,
  filters?: {
    unreadOnly?: boolean
    insightType?: string
    severity?: string
    actionableOnly?: boolean
    limit?: number
  }
) {
  const conditions = [eq(competitiveInsights.brandId, brandId)]
  if (filters?.unreadOnly) conditions.push(eq(competitiveInsights.isRead, false))
  if (filters?.insightType) conditions.push(eq(competitiveInsights.insightType, filters.insightType))
  if (filters?.severity) conditions.push(eq(competitiveInsights.severity, filters.severity))
  if (filters?.actionableOnly) conditions.push(eq(competitiveInsights.isActionable, true))
  conditions.push(
    or(
      isNull(competitiveInsights.expiresAt),
      gt(competitiveInsights.expiresAt, new Date())
    )!
  )

  return db
    .select()
    .from(competitiveInsights)
    .where(and(...conditions))
    .orderBy(desc(competitiveInsights.createdAt))
    .limit(filters?.limit ?? 50)
}

export async function markInsightRead(id: string) {
  const [row] = await db
    .update(competitiveInsights)
    .set({ isRead: true })
    .where(eq(competitiveInsights.id, id))
    .returning()
  return row ?? null
}

export async function createInsight(data: NewCompetitiveInsight) {
  const [row] = await db.insert(competitiveInsights).values(data).returning()
  return row
}

/**
 * Idempotency helper: true if an insight of the given type already exists
 * for this brand within the last N hours. Used by the cron (24h window) to
 * avoid regenerating the same AI insight repeatedly.
 */
export async function hasRecentInsight(
  brandId: string,
  insightType: string,
  hoursWindow: number
) {
  const since = new Date(Date.now() - hoursWindow * 60 * 60 * 1000)
  const [row] = await db
    .select({ id: competitiveInsights.id })
    .from(competitiveInsights)
    .where(
      and(
        eq(competitiveInsights.brandId, brandId),
        eq(competitiveInsights.insightType, insightType),
        gte(competitiveInsights.createdAt, since)
      )
    )
    .limit(1)
  return !!row
}

/**
 * Returns the number of insights created for this brand since midnight UTC.
 * The daily cap (3/brand/day) is enforced by the service layer using this.
 */
export async function getTodayInsightCount(brandId: string) {
  const startOfDay = new Date()
  startOfDay.setUTCHours(0, 0, 0, 0)
  const rows = await db
    .select({ n: drizzleSql<number>`count(*)::int` })
    .from(competitiveInsights)
    .where(
      and(
        eq(competitiveInsights.brandId, brandId),
        gte(competitiveInsights.createdAt, startOfDay)
      )
    )
  return rows[0]?.n ?? 0
}

// ═══════════════════════════════════════════════════════════════════════════
// ALERTS
// ═══════════════════════════════════════════════════════════════════════════

export async function getAlerts(
  brandId: string,
  filters?: { unreadOnly?: boolean; severity?: string; alertType?: string; limit?: number }
) {
  const conditions = [eq(competitorAlerts.brandId, brandId)]
  if (filters?.unreadOnly) conditions.push(eq(competitorAlerts.isRead, false))
  if (filters?.severity) conditions.push(eq(competitorAlerts.severity, filters.severity))
  if (filters?.alertType) conditions.push(eq(competitorAlerts.alertType, filters.alertType))

  return db
    .select()
    .from(competitorAlerts)
    .where(and(...conditions))
    .orderBy(desc(competitorAlerts.createdAt))
    .limit(filters?.limit ?? 50)
}

export async function markAlertRead(id: string) {
  const [row] = await db
    .update(competitorAlerts)
    .set({ isRead: true })
    .where(eq(competitorAlerts.id, id))
    .returning()
  return row ?? null
}

export async function createAlert(data: NewCompetitorAlert) {
  const [row] = await db.insert(competitorAlerts).values(data).returning()
  return row
}

// ═══════════════════════════════════════════════════════════════════════════
// REPORTS
// ═══════════════════════════════════════════════════════════════════════════

export async function getReports(
  brandId: string,
  filters?: { reportType?: string; category?: string; limit?: number }
) {
  const conditions = [eq(competitiveReports.brandId, brandId)]
  if (filters?.reportType) conditions.push(eq(competitiveReports.reportType, filters.reportType))
  if (filters?.category) conditions.push(eq(competitiveReports.category, filters.category))

  return db
    .select()
    .from(competitiveReports)
    .where(and(...conditions))
    .orderBy(desc(competitiveReports.createdAt))
    .limit(filters?.limit ?? 20)
}

export async function createReport(data: NewCompetitiveReport) {
  const [row] = await db.insert(competitiveReports).values(data).returning()
  return row
}

export async function markReportEmailed(id: string) {
  const [row] = await db
    .update(competitiveReports)
    .set({ emailSent: true, emailSentAt: new Date() })
    .where(eq(competitiveReports.id, id))
    .returning()
  return row ?? null
}

export async function getReportById(id: string) {
  const [row] = await db
    .select()
    .from(competitiveReports)
    .where(eq(competitiveReports.id, id))
    .limit(1)
  return row ?? null
}

/**
 * Unsent reports across all brands — drives the email-sender cron.
 * Ordered oldest-first so backlog drains in arrival order.
 */
export async function getUnsentReports(limit = 100) {
  return db
    .select()
    .from(competitiveReports)
    .where(eq(competitiveReports.emailSent, false))
    .orderBy(competitiveReports.createdAt)
    .limit(limit)
}

// ═══════════════════════════════════════════════════════════════════════════
// DIGEST PREFERENCES
// ═══════════════════════════════════════════════════════════════════════════

export async function getDigestPreferences(brandId: string) {
  const [row] = await db
    .select()
    .from(competitorDigestPreferences)
    .where(eq(competitorDigestPreferences.brandId, brandId))
    .limit(1)
  return row ?? null
}

export async function upsertDigestPreferences(
  brandId: string,
  data: Omit<Partial<NewCompetitorDigestPreferences>, 'brandId' | 'id' | 'createdAt'>
) {
  const existing = await getDigestPreferences(brandId)
  if (existing) {
    const [row] = await db
      .update(competitorDigestPreferences)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(competitorDigestPreferences.brandId, brandId))
      .returning()
    return row
  }
  const [row] = await db
    .insert(competitorDigestPreferences)
    .values({ brandId, ...data })
    .returning()
  return row
}

// ═══════════════════════════════════════════════════════════════════════════
// BENCHMARKS + SCORES
// ═══════════════════════════════════════════════════════════════════════════

export async function getBenchmarks(
  brandId: string,
  filters?: { category?: string; metricName?: string; since?: Date }
) {
  const conditions = [eq(competitiveBenchmarks.brandId, brandId)]
  if (filters?.category) conditions.push(eq(competitiveBenchmarks.category, filters.category))
  if (filters?.metricName) conditions.push(eq(competitiveBenchmarks.metricName, filters.metricName))
  if (filters?.since) conditions.push(gte(competitiveBenchmarks.computedAt, filters.since))

  return db
    .select()
    .from(competitiveBenchmarks)
    .where(and(...conditions))
    .orderBy(desc(competitiveBenchmarks.computedAt))
}

export async function upsertBenchmark(data: NewCompetitiveBenchmark) {
  const [row] = await db.insert(competitiveBenchmarks).values(data).returning()
  return row
}

export async function getCompetitiveScore(brandId: string, category: string) {
  const [row] = await db
    .select()
    .from(competitiveScores)
    .where(
      and(
        eq(competitiveScores.brandId, brandId),
        eq(competitiveScores.category, category)
      )
    )
    .limit(1)
  return row ?? null
}

export async function upsertCompetitiveScore(data: NewCompetitiveScore) {
  // UNIQUE(brand_id, category) enforced by migration — use ON CONFLICT.
  const [row] = await db
    .insert(competitiveScores)
    .values(data)
    .onConflictDoUpdate({
      target: [competitiveScores.brandId, competitiveScores.category],
      set: {
        overallScore: data.overallScore,
        scoreBreakdown: data.scoreBreakdown,
        rank: data.rank,
        totalInCategory: data.totalInCategory,
        trend: data.trend ?? 'stable',
        previousScore: data.previousScore,
        computedAt: new Date(),
      },
    })
    .returning()
  return row
}

/**
 * Leaderboard for a category, ordered by overallScore DESC.
 */
export async function getCategoryRankings(category: string, limit = 20) {
  return db
    .select()
    .from(competitiveScores)
    .where(eq(competitiveScores.category, category))
    .orderBy(desc(competitiveScores.overallScore))
    .limit(limit)
}

// ═══════════════════════════════════════════════════════════════════════════
// PRIVACY-GATED AGGREGATE READERS
// ═══════════════════════════════════════════════════════════════════════════
//
// These functions return `null` when the cohort is smaller than
// MIN_COHORT_SIZE. Callers MUST treat null as "not enough data — do not
// surface to user, do not feed to AI". Never mutate this behaviour to
// return zeros/placeholders — it defeats the re-identification floor.

type SentimentBreakdown = {
  positive: number
  neutral: number
  negative: number
  avgRating: number | null
  cohortSize: number
}

/**
 * Aggregate sentiment distribution across feedback for a set of products
 * (typically one brand's products or one competitor's on-platform products).
 * Returns null if cohort < 5.
 */
export async function getAggregatedSentiment(
  brandId: string,
  productIds: string[],
  opts?: { since?: Date }
): Promise<SentimentBreakdown | null> {
  if (productIds.length === 0) {
    logAggregateAccess(brandId, 'getAggregatedSentiment', 0, false)
    return null
  }

  const conditions = [inArray(feedback.productId, productIds)]
  if (opts?.since) conditions.push(gte(feedback.createdAt, opts.since))

  const rows = await db
    .select({
      positive: drizzleSql<number>`count(*) filter (where ${feedback.sentiment} = 'positive')::int`,
      neutral: drizzleSql<number>`count(*) filter (where ${feedback.sentiment} = 'neutral')::int`,
      negative: drizzleSql<number>`count(*) filter (where ${feedback.sentiment} = 'negative')::int`,
      avgRating: drizzleSql<number | null>`avg(${feedback.rating})::float`,
      cohortSize: drizzleSql<number>`count(*)::int`,
    })
    .from(feedback)
    .where(and(...conditions))

  const row = rows[0]
  const cohortSize = row?.cohortSize ?? 0

  if (cohortSize < MIN_COHORT_SIZE) {
    logAggregateAccess(brandId, 'getAggregatedSentiment', cohortSize, false)
    return null
  }

  logAggregateAccess(brandId, 'getAggregatedSentiment', cohortSize, true)
  return {
    positive: row.positive,
    neutral: row.neutral,
    negative: row.negative,
    avgRating: row.avgRating,
    cohortSize,
  }
}

type GeoDistribution = Array<{ region: string; count: number }>

/**
 * Geographic distribution of consumers who left feedback for a set of
 * products. Location is read from `user_profiles.demographics->>'location'`
 * (JSONB). Joins via `feedback.user_email = user_profiles.email`.
 * Returns null if total cohort < 5; also drops any region with < 5
 * consumers (re-identification risk per region, not just per query).
 */
export async function getGeographicDistribution(
  brandId: string,
  productIds: string[]
): Promise<GeoDistribution | null> {
  if (productIds.length === 0) {
    logAggregateAccess(brandId, 'getGeographicDistribution', 0, false)
    return null
  }

  const rows = await db.execute<{ region: string; count: number }>(drizzleSql`
    SELECT
      coalesce(up.demographics->>'location', 'unknown') AS region,
      count(DISTINCT f.user_email)::int AS count
    FROM feedback f
    LEFT JOIN user_profiles up ON up.email = f.user_email
    WHERE f.product_id = ANY(${productIds}) AND f.user_email IS NOT NULL
    GROUP BY coalesce(up.demographics->>'location', 'unknown')
  `)

  const list: Array<{ region: string; count: number }> = Array.isArray(rows)
    ? (rows as any)
    : (rows as any).rows ?? []

  const total = list.reduce((s, r) => s + Number(r.count), 0)
  if (total < MIN_COHORT_SIZE) {
    logAggregateAccess(brandId, 'getGeographicDistribution', total, false)
    return null
  }

  const safe = list
    .map((r) => ({ region: r.region, count: Number(r.count) }))
    .filter((r) => r.count >= MIN_COHORT_SIZE && r.region !== 'unknown')

  logAggregateAccess(brandId, 'getGeographicDistribution', total, true)
  return safe
}

type FeedbackThemeSummary = Array<{
  category: string
  count: number
  avgRating: number | null
}>

/**
 * Top feedback themes/categories for a set of products. Returns null if
 * total cohort < 5. Never returns raw feedback text — only category +
 * counts + avg rating. Per-theme cohort floor also enforced.
 */
export async function getFeedbackThemes(
  brandId: string,
  productIds: string[],
  opts?: { since?: Date; limit?: number }
): Promise<FeedbackThemeSummary | null> {
  if (productIds.length === 0) {
    logAggregateAccess(brandId, 'getFeedbackThemes', 0, false)
    return null
  }

  const conditions = [
    inArray(feedback.productId, productIds),
    isNotNull(feedback.category),
  ]
  if (opts?.since) conditions.push(gte(feedback.createdAt, opts.since))

  const rows = await db
    .select({
      category: drizzleSql<string>`${feedback.category}`,
      count: drizzleSql<number>`count(*)::int`,
      avgRating: drizzleSql<number | null>`avg(${feedback.rating})::float`,
    })
    .from(feedback)
    .where(and(...conditions))
    .groupBy(feedback.category)
    .orderBy(drizzleSql`count(*) desc`)
    .limit(opts?.limit ?? 10)

  const total = rows.reduce((s, r) => s + r.count, 0)
  if (total < MIN_COHORT_SIZE) {
    logAggregateAccess(brandId, 'getFeedbackThemes', total, false)
    return null
  }

  const safe = rows.filter((r) => r.count >= MIN_COHORT_SIZE)
  logAggregateAccess(brandId, 'getFeedbackThemes', total, true)
  return safe
}

type ConsumerOverlap = {
  overlapCount: number
  brandOnlyCount: number
  competitorOnlyCount: number
  overlapPct: number
}

/**
 * Consumers who left feedback for BOTH brand and competitor product sets.
 * Returns null if any of the three cohorts (brand-only, comp-only, overlap)
 * is below MIN_COHORT_SIZE — overlap of 2 consumers is easy to re-identify.
 */
export async function getConsumerOverlap(
  brandId: string,
  brandProductIds: string[],
  competitorProductIds: string[]
): Promise<ConsumerOverlap | null> {
  if (brandProductIds.length === 0 || competitorProductIds.length === 0) {
    logAggregateAccess(brandId, 'getConsumerOverlap', 0, false)
    return null
  }

  const rows = await db.execute<{
    overlap: number
    brand_only: number
    comp_only: number
  }>(drizzleSql`
    WITH brand_users AS (
      SELECT DISTINCT user_email FROM feedback
      WHERE product_id = ANY(${brandProductIds}) AND user_email IS NOT NULL
    ),
    comp_users AS (
      SELECT DISTINCT user_email FROM feedback
      WHERE product_id = ANY(${competitorProductIds}) AND user_email IS NOT NULL
    )
    SELECT
      (SELECT count(*) FROM brand_users b WHERE b.user_email IN (SELECT user_email FROM comp_users))::int AS overlap,
      (SELECT count(*) FROM brand_users b WHERE b.user_email NOT IN (SELECT user_email FROM comp_users))::int AS brand_only,
      (SELECT count(*) FROM comp_users c WHERE c.user_email NOT IN (SELECT user_email FROM brand_users))::int AS comp_only
  `)

  // drizzle .execute returns { rows: [...] } for postgres driver.
  const r: any = Array.isArray(rows) ? rows[0] : (rows as any).rows?.[0]
  if (!r) {
    logAggregateAccess(brandId, 'getConsumerOverlap', 0, false)
    return null
  }

  const overlap = Number(r.overlap) || 0
  const brandOnly = Number(r.brand_only) || 0
  const compOnly = Number(r.comp_only) || 0

  if (
    overlap < MIN_COHORT_SIZE ||
    brandOnly < MIN_COHORT_SIZE ||
    compOnly < MIN_COHORT_SIZE
  ) {
    logAggregateAccess(brandId, 'getConsumerOverlap', overlap, false)
    return null
  }

  const total = overlap + brandOnly + compOnly
  logAggregateAccess(brandId, 'getConsumerOverlap', total, true)
  return {
    overlapCount: overlap,
    brandOnlyCount: brandOnly,
    competitorOnlyCount: compOnly,
    overlapPct: total > 0 ? (overlap / total) * 100 : 0,
  }
}

type SentimentTrendPoint = {
  periodStart: string
  positive: number
  neutral: number
  negative: number
  cohortSize: number
}

/**
 * Sentiment trend for a category over time, bucketed weekly. Returns null
 * if total cohort < 5; drops any individual week below the floor.
 */
export async function getCategorySentimentTrend(
  brandId: string,
  category: string,
  opts?: { weeks?: number }
): Promise<SentimentTrendPoint[] | null> {
  const weeks = opts?.weeks ?? 12
  const since = new Date(Date.now() - weeks * 7 * 24 * 60 * 60 * 1000)

  const rows = await db
    .select({
      periodStart: drizzleSql<string>`to_char(date_trunc('week', ${feedback.createdAt}), 'YYYY-MM-DD')`,
      positive: drizzleSql<number>`count(*) filter (where ${feedback.sentiment} = 'positive')::int`,
      neutral: drizzleSql<number>`count(*) filter (where ${feedback.sentiment} = 'neutral')::int`,
      negative: drizzleSql<number>`count(*) filter (where ${feedback.sentiment} = 'negative')::int`,
      cohortSize: drizzleSql<number>`count(*)::int`,
    })
    .from(feedback)
    .innerJoin(products, eq(feedback.productId, products.id))
    .where(
      and(
        gte(feedback.createdAt, since),
        drizzleSql`${products.profile}->>'category' = ${category}`
      )
    )
    .groupBy(drizzleSql`date_trunc('week', ${feedback.createdAt})`)
    .orderBy(drizzleSql`date_trunc('week', ${feedback.createdAt})`)

  const total = rows.reduce((s, r) => s + r.cohortSize, 0)
  if (total < MIN_COHORT_SIZE) {
    logAggregateAccess(brandId, 'getCategorySentimentTrend', total, false)
    return null
  }

  const safe = rows.filter((r) => r.cohortSize >= MIN_COHORT_SIZE)
  logAggregateAccess(brandId, 'getCategorySentimentTrend', total, true)
  return safe
}
