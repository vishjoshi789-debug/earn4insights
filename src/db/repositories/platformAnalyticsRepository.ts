import 'server-only'

import { and, asc, desc, eq, gte, lte } from 'drizzle-orm'
import { db, pgClient } from '@/db'
import {
  platformMetricsDaily,
  revenueMetricsDaily,
  retentionCohorts,
  platformCosts,
  financialSnapshotsMonthly,
  type PlatformMetricsDaily,
  type NewPlatformMetricsDaily,
  type RevenueMetricsDaily,
  type NewRevenueMetricsDaily,
  type RetentionCohort,
  type NewRetentionCohort,
  type PlatformCost,
  type NewPlatformCost,
  type FinancialSnapshotMonthly,
  type NewFinancialSnapshotMonthly,
} from '@/db/schema'
import type { CostCategory, UserRole } from '@/lib/types/platformAnalytics'

// ════════════════════════════════════════════════════════════════
// DATE-RANGE READS
// ════════════════════════════════════════════════════════════════

export interface DateRange {
  from: Date
  to: Date // exclusive
}

const toDate = (d: Date) => d.toISOString().slice(0, 10) // yyyy-MM-dd

// ── platform_metrics_daily ───────────────────────────────────────

export async function getDailyMetrics(range: DateRange): Promise<PlatformMetricsDaily[]> {
  return db
    .select()
    .from(platformMetricsDaily)
    .where(
      and(
        gte(platformMetricsDaily.date, toDate(range.from)),
        lte(platformMetricsDaily.date, toDate(range.to)),
      ),
    )
    .orderBy(asc(platformMetricsDaily.date))
}

export async function getLatestDailyMetric(): Promise<PlatformMetricsDaily | null> {
  const [row] = await db
    .select()
    .from(platformMetricsDaily)
    .orderBy(desc(platformMetricsDaily.date))
    .limit(1)
  return row ?? null
}

export async function upsertDailyMetrics(
  date: Date,
  data: Omit<NewPlatformMetricsDaily, 'id' | 'date' | 'computedAt'>,
): Promise<PlatformMetricsDaily> {
  const dateStr = toDate(date)
  const [row] = await db
    .insert(platformMetricsDaily)
    .values({ date: dateStr, ...data, computedAt: new Date() })
    .onConflictDoUpdate({
      target: platformMetricsDaily.date,
      set: { ...data, computedAt: new Date() },
    })
    .returning()
  return row
}

// ── revenue_metrics_daily ────────────────────────────────────────

export async function getRevenueMetrics(range: DateRange): Promise<RevenueMetricsDaily[]> {
  return db
    .select()
    .from(revenueMetricsDaily)
    .where(
      and(
        gte(revenueMetricsDaily.date, toDate(range.from)),
        lte(revenueMetricsDaily.date, toDate(range.to)),
      ),
    )
    .orderBy(asc(revenueMetricsDaily.date))
}

export async function upsertRevenueMetrics(
  date: Date,
  data: Omit<NewRevenueMetricsDaily, 'id' | 'date' | 'computedAt'>,
): Promise<RevenueMetricsDaily> {
  const dateStr = toDate(date)
  const [row] = await db
    .insert(revenueMetricsDaily)
    .values({ date: dateStr, ...data, computedAt: new Date() })
    .onConflictDoUpdate({
      target: revenueMetricsDaily.date,
      set: { ...data, computedAt: new Date() },
    })
    .returning()
  return row
}

// ── retention_cohorts ────────────────────────────────────────────

export async function getRetentionCohorts(
  role: UserRole,
  periodType: 'daily' | 'weekly' | 'monthly' = 'weekly',
  limit = 12,
): Promise<RetentionCohort[]> {
  return db
    .select()
    .from(retentionCohorts)
    .where(and(eq(retentionCohorts.role, role), eq(retentionCohorts.periodType, periodType)))
    .orderBy(desc(retentionCohorts.cohortDate))
    .limit(limit)
}

export async function upsertRetentionCohort(
  data: Omit<NewRetentionCohort, 'id' | 'computedAt'>,
): Promise<RetentionCohort> {
  const [row] = await db
    .insert(retentionCohorts)
    .values({ ...data, computedAt: new Date() })
    .onConflictDoUpdate({
      target: [retentionCohorts.cohortDate, retentionCohorts.role, retentionCohorts.periodType],
      set: {
        cohortSize: data.cohortSize,
        day1: data.day1,
        day7: data.day7,
        day14: data.day14,
        day30: data.day30,
        day60: data.day60,
        day90: data.day90,
        computedAt: new Date(),
      },
    })
    .returning()
  return row
}

// ── platform_costs ───────────────────────────────────────────────

export async function getCosts(month: Date): Promise<PlatformCost[]> {
  // `month` is normalised to first-of-month by the service / API.
  return db
    .select()
    .from(platformCosts)
    .where(eq(platformCosts.month, toDate(month)))
    .orderBy(asc(platformCosts.category), asc(platformCosts.createdAt))
}

export async function getCostsForMonthRange(range: DateRange): Promise<PlatformCost[]> {
  return db
    .select()
    .from(platformCosts)
    .where(
      and(
        gte(platformCosts.month, toDate(range.from)),
        lte(platformCosts.month, toDate(range.to)),
      ),
    )
}

export async function addCost(
  data: Omit<NewPlatformCost, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<PlatformCost> {
  const [row] = await db
    .insert(platformCosts)
    .values({ ...data, createdAt: new Date(), updatedAt: new Date() })
    .returning()
  return row
}

export async function updateCost(
  id: string,
  data: Partial<Omit<NewPlatformCost, 'id' | 'createdAt'>>,
): Promise<PlatformCost | null> {
  const [row] = await db
    .update(platformCosts)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(platformCosts.id, id))
    .returning()
  return row ?? null
}

export async function deleteCost(id: string): Promise<boolean> {
  const result = await db.delete(platformCosts).where(eq(platformCosts.id, id)).returning()
  return result.length > 0
}

// ── financial_snapshots_monthly ──────────────────────────────────

export async function getFinancialSnapshot(month: Date): Promise<FinancialSnapshotMonthly | null> {
  const [row] = await db
    .select()
    .from(financialSnapshotsMonthly)
    .where(eq(financialSnapshotsMonthly.month, toDate(month)))
    .limit(1)
  return row ?? null
}

export async function getFinancialSnapshots(range: DateRange): Promise<FinancialSnapshotMonthly[]> {
  return db
    .select()
    .from(financialSnapshotsMonthly)
    .where(
      and(
        gte(financialSnapshotsMonthly.month, toDate(range.from)),
        lte(financialSnapshotsMonthly.month, toDate(range.to)),
      ),
    )
    .orderBy(asc(financialSnapshotsMonthly.month))
}

export async function upsertFinancialSnapshot(
  data: Omit<NewFinancialSnapshotMonthly, 'id' | 'computedAt'>,
): Promise<FinancialSnapshotMonthly> {
  const [row] = await db
    .insert(financialSnapshotsMonthly)
    .values({ ...data, computedAt: new Date() })
    .onConflictDoUpdate({
      target: financialSnapshotsMonthly.month,
      set: { ...data, computedAt: new Date() },
    })
    .returning()
  return row
}

// ════════════════════════════════════════════════════════════════
// LIVE COMPUTATION HELPERS (used by the service when building daily rows)
// ════════════════════════════════════════════════════════════════

// ── User counters ────────────────────────────────────────────────

export interface UserCountSnapshot {
  totalUsers: number
  totalBrands: number
  totalConsumers: number
  totalInfluencers: number
}

/**
 * Cumulative user counts AS OF the given timestamp. `is_influencer=true`
 * users count as both consumer AND influencer (per platform's role model:
 * influencers are consumers with the flag on).
 */
export async function getUserCountSnapshot(asOf: Date): Promise<UserCountSnapshot> {
  // Date → ISO string before SQL interpolation. postgres.js encodes Date
  // objects via Buffer-based binary protocol in some code paths and
  // throws "The string argument must be of type string. Received an
  // instance of Date" — passing the ISO string is unambiguous and
  // accepted by every postgres.js code path.
  const asOfIso = asOf.toISOString()
  const rows = await pgClient<{ role: string; is_influencer: boolean; n: string }[]>`
    SELECT role, is_influencer, COUNT(*)::text AS n
    FROM users
    WHERE created_at <= ${asOfIso}
    GROUP BY role, is_influencer
  `
  let totalUsers = 0
  let totalBrands = 0
  let totalConsumers = 0
  let totalInfluencers = 0
  for (const r of rows) {
    const n = Number(r.n)
    totalUsers += n
    if (r.role === 'brand') totalBrands += n
    if (r.role === 'consumer') {
      totalConsumers += n
      if (r.is_influencer) totalInfluencers += n
    }
  }
  return { totalUsers, totalBrands, totalConsumers, totalInfluencers }
}

export interface NewUserCounts {
  newUsers: number
  newBrands: number
  newConsumers: number
  newInfluencers: number
}

export async function getNewUserCount(range: DateRange): Promise<NewUserCounts> {
  const from = range.from.toISOString()
  const to = range.to.toISOString()
  const rows = await pgClient<{ role: string; is_influencer: boolean; n: string }[]>`
    SELECT role, is_influencer, COUNT(*)::text AS n
    FROM users
    WHERE created_at >= ${from} AND created_at < ${to}
    GROUP BY role, is_influencer
  `
  let newUsers = 0
  let newBrands = 0
  let newConsumers = 0
  let newInfluencers = 0
  for (const r of rows) {
    const n = Number(r.n)
    newUsers += n
    if (r.role === 'brand') newBrands += n
    if (r.role === 'consumer') {
      newConsumers += n
      if (r.is_influencer) newInfluencers += n
    }
  }
  return { newUsers, newBrands, newConsumers, newInfluencers }
}

// ── Active user counters (from analytics_events) ─────────────────

/**
 * Distinct user_id with any tracked event in [since, until).
 * Filters out anonymous events (user_id IS NULL).
 */
export async function getActiveUserCount(since: Date, until: Date, role?: UserRole): Promise<number> {
  const sinceIso = since.toISOString()
  const untilIso = until.toISOString()
  if (role && role !== 'all') {
    const rows = await pgClient<{ n: string }[]>`
      SELECT COUNT(DISTINCT user_id)::text AS n
      FROM analytics_events
      WHERE created_at >= ${sinceIso} AND created_at < ${untilIso}
        AND user_id IS NOT NULL
        AND user_role = ${role}
    `
    return Number(rows[0]?.n ?? 0)
  }
  const rows = await pgClient<{ n: string }[]>`
    SELECT COUNT(DISTINCT user_id)::text AS n
    FROM analytics_events
    WHERE created_at >= ${sinceIso} AND created_at < ${untilIso}
      AND user_id IS NOT NULL
  `
  return Number(rows[0]?.n ?? 0)
}

export interface DailyActiveByRolePoint {
  date: string
  dau: number
  brandDau: number
  consumerDau: number
  influencerDau: number
}

/**
 * Per-day DAU split by role over the range. Used by the user-growth chart
 * for the daily series. NOTE: influencer DAU here is `is_influencer=true`
 * consumers (we join to users to read the flag).
 */
export async function getDailyActiveByRole(range: DateRange): Promise<DailyActiveByRolePoint[]> {
  const from = range.from.toISOString()
  const to = range.to.toISOString()
  const rows = await pgClient<{
    day: string
    dau: string
    brand_dau: string
    consumer_dau: string
    influencer_dau: string
  }[]>`
    SELECT
      to_char(date_trunc('day', e.created_at), 'YYYY-MM-DD') AS day,
      COUNT(DISTINCT e.user_id)::text AS dau,
      COUNT(DISTINCT e.user_id) FILTER (WHERE u.role = 'brand')::text AS brand_dau,
      COUNT(DISTINCT e.user_id) FILTER (WHERE u.role = 'consumer')::text AS consumer_dau,
      COUNT(DISTINCT e.user_id) FILTER (WHERE u.is_influencer = true)::text AS influencer_dau
    FROM analytics_events e
    LEFT JOIN users u ON u.id = e.user_id
    WHERE e.created_at >= ${from} AND e.created_at < ${to}
      AND e.user_id IS NOT NULL
    GROUP BY 1
    ORDER BY 1 ASC
  `
  return rows.map((r) => ({
    date: r.day,
    dau: Number(r.dau),
    brandDau: Number(r.brand_dau),
    consumerDau: Number(r.consumer_dau),
    influencerDau: Number(r.influencer_dau),
  }))
}

// ── Engagement counters (per-day for one calendar day) ───────────

export interface DailyEngagement {
  feedbackCount: number
  surveyResponses: number
  dealsRedeemed: number
  communityPosts: number
  communityComments: number
  campaignsCreated: number
  campaignsCompleted: number
  chatConversations: number
  chatResolvedByAi: number
  supportTickets: number
}

export async function getDailyEngagement(range: DateRange): Promise<DailyEngagement> {
  // Single round-trip via UNION ALL — cheaper than 10 separate queries.
  // NOTE: column name corrections vs spec —
  //   deal_redemptions uses redeemed_at (not created_at)
  //   survey_responses uses submitted_at (matches spec)
  const from = range.from.toISOString()
  const to = range.to.toISOString()
  const rows = await pgClient<{ k: string; n: string }[]>`
    SELECT 'feedback'::text AS k,
           (SELECT COUNT(*)::text FROM feedback WHERE created_at >= ${from} AND created_at < ${to}) AS n
    UNION ALL SELECT 'survey_responses',
           (SELECT COUNT(*)::text FROM survey_responses WHERE submitted_at >= ${from} AND submitted_at < ${to})
    UNION ALL SELECT 'deals_redeemed',
           (SELECT COUNT(*)::text FROM deal_redemptions WHERE redeemed_at >= ${from} AND redeemed_at < ${to})
    UNION ALL SELECT 'community_posts',
           (SELECT COUNT(*)::text FROM community_deals_posts WHERE created_at >= ${from} AND created_at < ${to})
    UNION ALL SELECT 'community_comments',
           (SELECT COUNT(*)::text FROM community_deals_comments WHERE created_at >= ${from} AND created_at < ${to})
    UNION ALL SELECT 'campaigns_created',
           (SELECT COUNT(*)::text FROM influencer_campaigns WHERE created_at >= ${from} AND created_at < ${to})
    UNION ALL SELECT 'campaigns_completed',
           (SELECT COUNT(*)::text FROM influencer_campaigns WHERE status = 'completed' AND updated_at >= ${from} AND updated_at < ${to})
    UNION ALL SELECT 'chat_conversations',
           (SELECT COUNT(*)::text FROM chat_conversations WHERE created_at >= ${from} AND created_at < ${to})
    UNION ALL SELECT 'chat_resolved_by_ai',
           (SELECT COUNT(*)::text FROM chat_conversations WHERE resolved_by_ai = true AND created_at >= ${from} AND created_at < ${to})
    UNION ALL SELECT 'support_tickets',
           (SELECT COUNT(*)::text FROM support_tickets WHERE created_at >= ${from} AND created_at < ${to})
  `
  const m = new Map(rows.map((r) => [r.k, Number(r.n)]))
  return {
    feedbackCount: m.get('feedback') ?? 0,
    surveyResponses: m.get('survey_responses') ?? 0,
    dealsRedeemed: m.get('deals_redeemed') ?? 0,
    communityPosts: m.get('community_posts') ?? 0,
    communityComments: m.get('community_comments') ?? 0,
    campaignsCreated: m.get('campaigns_created') ?? 0,
    campaignsCompleted: m.get('campaigns_completed') ?? 0,
    chatConversations: m.get('chat_conversations') ?? 0,
    chatResolvedByAi: m.get('chat_resolved_by_ai') ?? 0,
    supportTickets: m.get('support_tickets') ?? 0,
  }
}

// ── Payment metrics ──────────────────────────────────────────────

export interface PaymentMetrics {
  grossRevenue: number          // paise — sum of campaign_payments.amount where escrowed/released
  platformFees: number          // paise
  influencerPayouts: number     // paise
  consumerRewardsRedeemed: number // paise — points_spent / 10 (10 pts = ₹1 = 100 paise → 10 paise/point)
  refunds: number               // paise
  paymentCount: number
  paymentSuccessCount: number
  paymentFailedCount: number
  avgPaymentAmount: number      // paise
}

export async function getPaymentMetrics(range: DateRange): Promise<PaymentMetrics> {
  const from = range.from.toISOString()
  const to = range.to.toISOString()
  // campaign_payments aggregate (gross, fees, payouts, refunds, counts)
  const [pay] = await pgClient<{
    gross: string | null
    fees: string | null
    payouts: string | null
    refunds: string | null
    total_count: string
    success_count: string
    failed_count: string
    avg_amt: string | null
  }[]>`
    SELECT
      SUM(CASE WHEN status IN ('escrowed', 'released') THEN amount ELSE 0 END)::text AS gross,
      SUM(CASE WHEN status IN ('escrowed', 'released') THEN platform_fee ELSE 0 END)::text AS fees,
      SUM(CASE WHEN status = 'released' AND released_at >= ${from} AND released_at < ${to}
               THEN influencer_amount ELSE 0 END)::text AS payouts,
      SUM(CASE WHEN status = 'refunded' AND refunded_at >= ${from} AND refunded_at < ${to}
               THEN amount ELSE 0 END)::text AS refunds,
      COUNT(*)::text AS total_count,
      COUNT(*) FILTER (WHERE status IN ('escrowed', 'released'))::text AS success_count,
      COUNT(*) FILTER (WHERE status = 'failed')::text AS failed_count,
      AVG(CASE WHEN status IN ('escrowed', 'released') THEN amount ELSE NULL END)::text AS avg_amt
    FROM campaign_payments
    WHERE created_at >= ${from} AND created_at < ${to}
  `

  // Consumer rewards redeemed value in paise
  // points_spent × 10 paise/point (since 10 pts = ₹1 = 100 paise)
  const [rew] = await pgClient<{ pts: string | null }[]>`
    SELECT SUM(points_spent)::text AS pts
    FROM reward_redemptions
    WHERE created_at >= ${from} AND created_at < ${to}
      AND status = 'fulfilled'
  `

  const gross = Number(pay?.gross ?? 0)
  return {
    grossRevenue: gross,
    platformFees: Number(pay?.fees ?? 0),
    influencerPayouts: Number(pay?.payouts ?? 0),
    consumerRewardsRedeemed: Number(rew?.pts ?? 0) * 10,
    refunds: Number(pay?.refunds ?? 0),
    paymentCount: Number(pay?.total_count ?? 0),
    paymentSuccessCount: Number(pay?.success_count ?? 0),
    paymentFailedCount: Number(pay?.failed_count ?? 0),
    avgPaymentAmount: Math.round(Number(pay?.avg_amt ?? 0)),
  }
}

// ── Feature adoption ─────────────────────────────────────────────

export interface FeatureUsageRow {
  feature: string
  brandUsers: number
  consumerUsers: number
  influencerUsers: number
}

/**
 * Distinct users per (feature, role) over the range. Denominator (active
 * users per role) is computed separately by the service so the
 * percentage view stays decoupled from the absolute counts here.
 */
export async function getFeatureUsage(range: DateRange): Promise<FeatureUsageRow[]> {
  // Column-name corrections vs spec (verified against schema.ts):
  //   feedback / survey_responses — no user_id; we attribute via user_email → users.email join
  //   deal_redemptions — consumer_id (not user_id), redeemed_at (not created_at)
  //   community_deals_posts / _comments — author_id (not user_id)
  //   dsar_requests — consumer_id (not user_id)
  const from = range.from.toISOString()
  const to = range.to.toISOString()
  const rows = await pgClient<{
    feature: string
    brand_users: string
    consumer_users: string
    influencer_users: string
  }[]>`
    WITH usage AS (
      -- feedback / surveys: attribute via email join (no FK column on those tables)
      SELECT 'feedback'::text AS feature, u.id AS user_id
      FROM feedback f
      JOIN users u ON u.email = f.user_email
      WHERE f.created_at >= ${from} AND f.created_at < ${to}
        AND f.user_email IS NOT NULL
      UNION ALL
      SELECT 'surveys', u.id
      FROM survey_responses sr
      JOIN users u ON u.email = sr.user_email
      WHERE sr.submitted_at >= ${from} AND sr.submitted_at < ${to}
        AND sr.user_email IS NOT NULL
      UNION ALL
      SELECT 'deals', dr.consumer_id
      FROM deal_redemptions dr
      WHERE dr.redeemed_at >= ${from} AND dr.redeemed_at < ${to}
      UNION ALL
      SELECT 'community', cp.author_id
      FROM community_deals_posts cp
      WHERE cp.created_at >= ${from} AND cp.created_at < ${to}
      UNION ALL
      SELECT 'campaigns', ic.brand_id
      FROM influencer_campaigns ic
      WHERE ic.created_at >= ${from} AND ic.created_at < ${to}
      UNION ALL
      SELECT 'icp', bi.brand_id
      FROM brand_icps bi
      WHERE bi.created_at >= ${from} AND bi.created_at < ${to}
      UNION ALL
      SELECT 'competitive_intel', cprof.brand_id
      FROM competitor_profiles cprof
      WHERE cprof.created_at >= ${from} AND cprof.created_at < ${to}
      UNION ALL
      SELECT 'social_hub', csc.user_id
      FROM consumer_social_connections csc
      WHERE csc.created_at >= ${from} AND csc.created_at < ${to}
      UNION ALL
      SELECT 'dsar', dr.consumer_id
      FROM dsar_requests dr
      WHERE dr.created_at >= ${from} AND dr.created_at < ${to}
      UNION ALL
      SELECT 'support_chat', cc.user_id
      FROM chat_conversations cc
      WHERE cc.created_at >= ${from} AND cc.created_at < ${to}
    )
    SELECT
      u.feature,
      COUNT(DISTINCT u.user_id) FILTER (WHERE usr.role = 'brand')::text AS brand_users,
      COUNT(DISTINCT u.user_id) FILTER (WHERE usr.role = 'consumer' AND usr.is_influencer = false)::text AS consumer_users,
      COUNT(DISTINCT u.user_id) FILTER (WHERE usr.is_influencer = true)::text AS influencer_users
    FROM usage u
    LEFT JOIN users usr ON usr.id = u.user_id
    WHERE u.user_id IS NOT NULL
    GROUP BY u.feature
  `
  return rows.map((r) => ({
    feature: r.feature,
    brandUsers: Number(r.brand_users),
    consumerUsers: Number(r.consumer_users),
    influencerUsers: Number(r.influencer_users),
  }))
}

// ── Cohort retention (signup → activity windows) ─────────────────

export interface CohortBuildResult {
  cohortDate: string         // ISO yyyy-MM-dd (start of cohort week/month)
  role: UserRole
  cohortSize: number
  day1: number | null
  day7: number | null
  day14: number | null
  day30: number | null
  day60: number | null
  day90: number | null
}

/**
 * Build cohort retention rows for cohorts that signed up in the given
 * range. Each cohort is one week (Mon–Sun). For each (cohort, day_N)
 * cell we compute: distinct users from the cohort with at least one
 * analytics_events row in [signup_date + N - 1, signup_date + N + 1)
 * — a 2-day window centered on day_N, which absorbs minor weekend
 * gaps in low-volume periods.
 *
 * roleFilter:
 *   'all'        — cohort = all signups
 *   'brand'      — users.role='brand'
 *   'consumer'   — users.role='consumer' AND is_influencer=false
 *   'influencer' — is_influencer=true
 */
export async function buildCohortRetention(
  weeksBack: number,
  roleFilter: UserRole,
): Promise<CohortBuildResult[]> {
  // Branch the SQL by role rather than trying to compose mid-query — keeps
  // the query analyzer-friendly and avoids template-tag composition pitfalls.
  type Row = {
    cohort_start: string
    cohort_size: string
    d1: string | null
    d7: string | null
    d14: string | null
    d30: string | null
    d60: string | null
    d90: string | null
  }

  const runQuery = async (): Promise<Row[]> => {
    if (roleFilter === 'all') {
      return pgClient<Row[]>`
        WITH cohort AS (
          SELECT date_trunc('week', u.created_at)::date AS cohort_start,
                 u.id AS user_id, u.created_at AS signed_up_at
          FROM users u
          WHERE u.created_at >= NOW() - (${weeksBack}::int * INTERVAL '1 week')
        ),
        activity AS (
          SELECT DISTINCT c.cohort_start, c.user_id,
            EXTRACT(EPOCH FROM (e.created_at - c.signed_up_at)) / 86400 AS day_offset
          FROM cohort c
          JOIN analytics_events e ON e.user_id = c.user_id
            AND e.created_at >= c.signed_up_at
            AND e.created_at < c.signed_up_at + INTERVAL '95 days'
        )
        SELECT
          to_char(c.cohort_start, 'YYYY-MM-DD') AS cohort_start,
          COUNT(DISTINCT c.user_id)::text AS cohort_size,
          (COUNT(DISTINCT a.user_id) FILTER (WHERE a.day_offset BETWEEN 0 AND 1.5))::text AS d1,
          (COUNT(DISTINCT a.user_id) FILTER (WHERE a.day_offset BETWEEN 5.5 AND 7.5))::text AS d7,
          (COUNT(DISTINCT a.user_id) FILTER (WHERE a.day_offset BETWEEN 12.5 AND 14.5))::text AS d14,
          (COUNT(DISTINCT a.user_id) FILTER (WHERE a.day_offset BETWEEN 28.5 AND 30.5))::text AS d30,
          (COUNT(DISTINCT a.user_id) FILTER (WHERE a.day_offset BETWEEN 58.5 AND 60.5))::text AS d60,
          (COUNT(DISTINCT a.user_id) FILTER (WHERE a.day_offset BETWEEN 88.5 AND 90.5))::text AS d90
        FROM cohort c
        LEFT JOIN activity a ON a.cohort_start = c.cohort_start AND a.user_id = c.user_id
        GROUP BY c.cohort_start
        ORDER BY c.cohort_start DESC
      `
    }
    if (roleFilter === 'brand') {
      return pgClient<Row[]>`
        WITH cohort AS (
          SELECT date_trunc('week', u.created_at)::date AS cohort_start,
                 u.id AS user_id, u.created_at AS signed_up_at
          FROM users u
          WHERE u.created_at >= NOW() - (${weeksBack}::int * INTERVAL '1 week')
            AND u.role = 'brand'
        ),
        activity AS (
          SELECT DISTINCT c.cohort_start, c.user_id,
            EXTRACT(EPOCH FROM (e.created_at - c.signed_up_at)) / 86400 AS day_offset
          FROM cohort c
          JOIN analytics_events e ON e.user_id = c.user_id
            AND e.created_at >= c.signed_up_at
            AND e.created_at < c.signed_up_at + INTERVAL '95 days'
        )
        SELECT
          to_char(c.cohort_start, 'YYYY-MM-DD') AS cohort_start,
          COUNT(DISTINCT c.user_id)::text AS cohort_size,
          (COUNT(DISTINCT a.user_id) FILTER (WHERE a.day_offset BETWEEN 0 AND 1.5))::text AS d1,
          (COUNT(DISTINCT a.user_id) FILTER (WHERE a.day_offset BETWEEN 5.5 AND 7.5))::text AS d7,
          (COUNT(DISTINCT a.user_id) FILTER (WHERE a.day_offset BETWEEN 12.5 AND 14.5))::text AS d14,
          (COUNT(DISTINCT a.user_id) FILTER (WHERE a.day_offset BETWEEN 28.5 AND 30.5))::text AS d30,
          (COUNT(DISTINCT a.user_id) FILTER (WHERE a.day_offset BETWEEN 58.5 AND 60.5))::text AS d60,
          (COUNT(DISTINCT a.user_id) FILTER (WHERE a.day_offset BETWEEN 88.5 AND 90.5))::text AS d90
        FROM cohort c
        LEFT JOIN activity a ON a.cohort_start = c.cohort_start AND a.user_id = c.user_id
        GROUP BY c.cohort_start
        ORDER BY c.cohort_start DESC
      `
    }
    if (roleFilter === 'consumer') {
      return pgClient<Row[]>`
        WITH cohort AS (
          SELECT date_trunc('week', u.created_at)::date AS cohort_start,
                 u.id AS user_id, u.created_at AS signed_up_at
          FROM users u
          WHERE u.created_at >= NOW() - (${weeksBack}::int * INTERVAL '1 week')
            AND u.role = 'consumer' AND u.is_influencer = false
        ),
        activity AS (
          SELECT DISTINCT c.cohort_start, c.user_id,
            EXTRACT(EPOCH FROM (e.created_at - c.signed_up_at)) / 86400 AS day_offset
          FROM cohort c
          JOIN analytics_events e ON e.user_id = c.user_id
            AND e.created_at >= c.signed_up_at
            AND e.created_at < c.signed_up_at + INTERVAL '95 days'
        )
        SELECT
          to_char(c.cohort_start, 'YYYY-MM-DD') AS cohort_start,
          COUNT(DISTINCT c.user_id)::text AS cohort_size,
          (COUNT(DISTINCT a.user_id) FILTER (WHERE a.day_offset BETWEEN 0 AND 1.5))::text AS d1,
          (COUNT(DISTINCT a.user_id) FILTER (WHERE a.day_offset BETWEEN 5.5 AND 7.5))::text AS d7,
          (COUNT(DISTINCT a.user_id) FILTER (WHERE a.day_offset BETWEEN 12.5 AND 14.5))::text AS d14,
          (COUNT(DISTINCT a.user_id) FILTER (WHERE a.day_offset BETWEEN 28.5 AND 30.5))::text AS d30,
          (COUNT(DISTINCT a.user_id) FILTER (WHERE a.day_offset BETWEEN 58.5 AND 60.5))::text AS d60,
          (COUNT(DISTINCT a.user_id) FILTER (WHERE a.day_offset BETWEEN 88.5 AND 90.5))::text AS d90
        FROM cohort c
        LEFT JOIN activity a ON a.cohort_start = c.cohort_start AND a.user_id = c.user_id
        GROUP BY c.cohort_start
        ORDER BY c.cohort_start DESC
      `
    }
    // influencer
    return pgClient<Row[]>`
      WITH cohort AS (
        SELECT date_trunc('week', u.created_at)::date AS cohort_start,
               u.id AS user_id, u.created_at AS signed_up_at
        FROM users u
        WHERE u.created_at >= NOW() - (${weeksBack}::int * INTERVAL '1 week')
          AND u.is_influencer = true
      ),
      activity AS (
        SELECT DISTINCT c.cohort_start, c.user_id,
          EXTRACT(EPOCH FROM (e.created_at - c.signed_up_at)) / 86400 AS day_offset
        FROM cohort c
        JOIN analytics_events e ON e.user_id = c.user_id
          AND e.created_at >= c.signed_up_at
          AND e.created_at < c.signed_up_at + INTERVAL '95 days'
      )
      SELECT
        to_char(c.cohort_start, 'YYYY-MM-DD') AS cohort_start,
        COUNT(DISTINCT c.user_id)::text AS cohort_size,
        (COUNT(DISTINCT a.user_id) FILTER (WHERE a.day_offset BETWEEN 0 AND 1.5))::text AS d1,
        (COUNT(DISTINCT a.user_id) FILTER (WHERE a.day_offset BETWEEN 5.5 AND 7.5))::text AS d7,
        (COUNT(DISTINCT a.user_id) FILTER (WHERE a.day_offset BETWEEN 12.5 AND 14.5))::text AS d14,
        (COUNT(DISTINCT a.user_id) FILTER (WHERE a.day_offset BETWEEN 28.5 AND 30.5))::text AS d30,
        (COUNT(DISTINCT a.user_id) FILTER (WHERE a.day_offset BETWEEN 58.5 AND 60.5))::text AS d60,
        (COUNT(DISTINCT a.user_id) FILTER (WHERE a.day_offset BETWEEN 88.5 AND 90.5))::text AS d90
      FROM cohort c
      LEFT JOIN activity a ON a.cohort_start = c.cohort_start AND a.user_id = c.user_id
      GROUP BY c.cohort_start
      ORDER BY c.cohort_start DESC
    `
  }

  const rows = await runQuery()
  const now = new Date()
  return rows.map((r) => {
    const size = Number(r.cohort_size)
    const pct = (raw: string | null, dayN: number): number | null => {
      if (size === 0) return null
      // Don't report retention% for cells that haven't matured yet —
      // a 3-day-old cohort can't have a Day 7 number.
      const cohortStart = new Date(r.cohort_start)
      const maturityDays = Math.floor((now.getTime() - cohortStart.getTime()) / (24 * 60 * 60 * 1000))
      if (maturityDays < dayN) return null
      return Math.round((Number(raw ?? 0) / size) * 10000) / 100 // 2dp
    }
    return {
      cohortDate: r.cohort_start,
      role: roleFilter,
      cohortSize: size,
      day1: pct(r.d1, 1),
      day7: pct(r.d7, 7),
      day14: pct(r.d14, 14),
      day30: pct(r.d30, 30),
      day60: pct(r.d60, 60),
      day90: pct(r.d90, 90),
    }
  })
}

// ════════════════════════════════════════════════════════════════
// CONVENIENCE: cost category enum normaliser (defensive)
// ════════════════════════════════════════════════════════════════

const VALID_CATEGORIES: Set<CostCategory> = new Set([
  'hosting', 'database', 'ai_api', 'email_service', 'sms_whatsapp',
  'cdn_storage', 'payment_gateway', 'marketing', 'salaries', 'legal',
  'office', 'tools_subscriptions', 'other',
])

export function isValidCostCategory(value: string): value is CostCategory {
  return VALID_CATEGORIES.has(value as CostCategory)
}
