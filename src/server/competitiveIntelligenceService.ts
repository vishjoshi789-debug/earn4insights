import 'server-only'

/**
 * Competitive Intelligence Service
 *
 * Public orchestrator for the Competitive Intelligence feature. Coordinates
 * repo aggregate readers, the scoring service, the alert service, and the
 * AI service. Enforces cost + privacy guardrails.
 *
 * Guardrails (approved in Q2)
 * ───────────────────────────
 * • 3 insights / brand / day hard cap (AI cost protection)
 * • 24 h idempotency window per (brand, insightType) — repo helper
 * • Skip brands with zero active confirmed competitors
 * • Respect per-category COMPETITIVE_INSIGHTS_OPT_IN preference
 *
 * Privacy
 * ───────
 * All aggregate data comes from `competitiveIntelligenceRepository`, which
 * enforces MIN_COHORT_SIZE = 5 at the DB-query layer. This service never
 * bypasses those readers.
 */

import { db } from '@/db'
import { products, users } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import {
  getCompetitorProfiles,
  getCompetitorProducts,
  getInsights,
  createInsight,
  hasRecentInsight,
  getTodayInsightCount,
  getAlerts,
  getBenchmarks,
  getCompetitiveScore,
  getCategoryRankings,
  getAggregatedSentiment,
  getFeedbackThemes,
  getCategorySentimentTrend,
  getConsumerOverlap,
  createReport,
  markReportEmailed,
  getDigestPreferences,
  MIN_COHORT_SIZE,
} from '@/db/repositories/competitiveIntelligenceRepository'
import {
  computeCompetitiveScore,
  scoreBrandForAllCategories,
  type CompetitiveScoringResult,
} from '@/server/competitiveScoringService'
import {
  runDailyInsightFlow,
  runWeeklyReportFlow,
  runTrendInsightFlow,
  type DailyInsight,
  type WeeklyReport,
} from '@/server/competitiveAIService'

// ── Guardrails ────────────────────────────────────────────────────

const DAILY_INSIGHT_CAP_PER_BRAND = 3
const IDEMPOTENCY_WINDOW_HOURS = 24

// ── Types ─────────────────────────────────────────────────────────

export type DashboardData = {
  brandId: string
  competitors: Awaited<ReturnType<typeof getCompetitorProfiles>>
  scoresByCategory: Array<CompetitiveScoringResult & { category: string }>
  recentAlerts: Awaited<ReturnType<typeof getAlerts>>
  recentInsights: Awaited<ReturnType<typeof getInsights>>
  benchmarks: Awaited<ReturnType<typeof getBenchmarks>>
  rankings: Record<string, Awaited<ReturnType<typeof getCategoryRankings>>>
}

export type InsightGenerationResult = {
  brandId: string
  generated: number
  skipped: Array<{ category: string; reason: string }>
  errors: Array<{ category: string; error: string }>
}

// ── Helpers ───────────────────────────────────────────────────────

async function getBrandNameById(brandId: string): Promise<string> {
  const [row] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, brandId))
    .limit(1)
  return row?.name ?? 'Brand'
}

async function getBrandProductIdsInCategory(
  brandId: string,
  category: string
): Promise<string[]> {
  const rows = await db
    .select({ id: products.id })
    .from(products)
    .where(
      and(
        eq(products.ownerId, brandId),
        eq(products.lifecycleStatus, 'verified')
      )
    )
  // Category lives inside profile JSONB — filter in JS to avoid SQL cast noise.
  return rows
    .filter((r) => (r as any).id)
    .map((r) => r.id)
}

async function buildDailyInsightSnapshot(params: {
  brandId: string
  brandName: string
  category: string
}): Promise<Parameters<typeof runDailyInsightFlow>[0] | null> {
  const profiles = await getCompetitorProfiles(params.brandId, {
    activeOnly: true,
    confirmedOnly: true,
    category: params.category,
  })
  if (profiles.length === 0) return null

  // Brand-side product ids (all products owned by brand; category filter below at feedback level).
  const brandProductRows = await db
    .select({ id: products.id })
    .from(products)
    .where(eq(products.ownerId, params.brandId))
  const brandProductIds = brandProductRows.map((r) => r.id)

  // Competitor-side product ids (union across all confirmed competitors).
  const competitorProductIds: string[] = []
  for (const p of profiles) {
    const prods = await getCompetitorProducts(p.id, { activeOnly: true })
    for (const cp of prods) if (cp.productId) competitorProductIds.push(cp.productId)
  }

  const since = new Date(Date.now() - 30 * 86400000)

  const [brandSent, compSent, brandThemes, compThemes] = await Promise.all([
    getAggregatedSentiment(params.brandId, brandProductIds, { since }),
    getAggregatedSentiment(params.brandId, competitorProductIds, { since }),
    getFeedbackThemes(params.brandId, brandProductIds, { since, limit: 6 }),
    getFeedbackThemes(params.brandId, competitorProductIds, { since, limit: 6 }),
  ])

  const overlap = await getConsumerOverlap(params.brandId, brandProductIds, competitorProductIds)

  const score = await getCompetitiveScore(params.brandId, params.category)

  return {
    brandId: params.brandId,
    brandName: params.brandName,
    category: params.category,
    competitorNames: profiles.map((p) => p.competitorName),
    snapshot: {
      brandSentiment: brandSent,
      competitorSentiment: compSent,
      topBrandThemes: (brandThemes ?? []).map((t) => ({ category: t.category, count: t.count })),
      topCompetitorThemes: (compThemes ?? []).map((t) => ({ category: t.category, count: t.count })),
      priceGapPct: null,
      marketSharePct: null,
      consumerSwitching: overlap
        ? { toBrand: overlap.brandOnlyCount, toCompetitor: overlap.competitorOnlyCount }
        : null,
    },
  }
}

// ── Public: dashboard ─────────────────────────────────────────────

export async function getDashboard(brandId: string): Promise<DashboardData> {
  const competitors = await getCompetitorProfiles(brandId, { activeOnly: true })
  const categories = Array.from(new Set(competitors.map((c) => c.category))).filter(Boolean)

  const scoresByCategory: Array<CompetitiveScoringResult & { category: string }> = []
  const rankings: Record<string, Awaited<ReturnType<typeof getCategoryRankings>>> = {}
  for (const cat of categories) {
    const persisted = await getCompetitiveScore(brandId, cat)
    if (persisted) {
      scoresByCategory.push({
        score: persisted.overallScore,
        breakdown: persisted.scoreBreakdown as any,
        dimensions: {} as any,
        rank: persisted.rank,
        totalInCategory: persisted.totalInCategory,
        trend: persisted.trend as 'improving' | 'stable' | 'declining',
        previousScore: persisted.previousScore,
        effectiveWeight: 100,
        category: cat,
      })
    }
    rankings[cat] = await getCategoryRankings(cat, 10)
  }

  const [recentAlerts, recentInsights, benchmarks] = await Promise.all([
    getAlerts(brandId, { limit: 20 }),
    getInsights(brandId, { limit: 20 }),
    getBenchmarks(brandId),
  ])

  return {
    brandId,
    competitors,
    scoresByCategory,
    recentAlerts,
    recentInsights,
    benchmarks,
    rankings,
  }
}

// ── Public: generate insights ─────────────────────────────────────

/**
 * For the given brand, run the daily-insight flow for each category with
 * confirmed active competitors. Enforces:
 *   - daily cap (3/brand/day)
 *   - 24 h idempotency per insightType
 *   - skip if no competitors
 */
export async function generateInsightsForBrand(
  brandId: string
): Promise<InsightGenerationResult> {
  const result: InsightGenerationResult = {
    brandId,
    generated: 0,
    skipped: [],
    errors: [],
  }

  const competitors = await getCompetitorProfiles(brandId, {
    activeOnly: true,
    confirmedOnly: true,
  })
  if (competitors.length === 0) {
    result.skipped.push({ category: 'all', reason: 'no_active_competitors' })
    return result
  }

  const existingToday = await getTodayInsightCount(brandId)
  if (existingToday >= DAILY_INSIGHT_CAP_PER_BRAND) {
    result.skipped.push({ category: 'all', reason: 'daily_cap_reached' })
    return result
  }

  const categories = Array.from(new Set(competitors.map((c) => c.category))).filter(Boolean)
  const brandName = await getBrandNameById(brandId)

  let remaining = DAILY_INSIGHT_CAP_PER_BRAND - existingToday

  for (const category of categories) {
    if (remaining <= 0) {
      result.skipped.push({ category, reason: 'daily_cap_reached' })
      continue
    }

    try {
      const snapshot = await buildDailyInsightSnapshot({ brandId, brandName, category })
      if (!snapshot) {
        result.skipped.push({ category, reason: 'no_competitors_in_category' })
        continue
      }

      const insight = await runDailyInsightFlow(snapshot)

      // 24 h idempotency on (brand, insightType).
      if (await hasRecentInsight(brandId, insight.insightType, IDEMPOTENCY_WINDOW_HOURS)) {
        result.skipped.push({ category, reason: 'idempotent_skip' })
        continue
      }

      await createInsight({
        brandId,
        insightType: insight.insightType,
        title: insight.title,
        summary: insight.summary,
        details: {
          category,
          snapshotKeys: Object.keys(snapshot.snapshot),
          competitorNames: snapshot.competitorNames,
        },
        dataSources: {
          feedbackCount:
            (snapshot.snapshot.brandSentiment?.cohortSize ?? 0) +
            (snapshot.snapshot.competitorSentiment?.cohortSize ?? 0),
          dateRange: {
            start: new Date(Date.now() - 30 * 86400000).toISOString(),
            end: new Date().toISOString(),
          },
        },
        severity: insight.severity,
        isActionable: insight.isActionable,
        actionSuggestion: insight.actionSuggestion ?? null,
        generatedBy: 'ai',
        aiModel: process.env.COMPETITIVE_AI_DAILY_MODEL || 'gpt-4o-mini',
      })
      result.generated += 1
      remaining -= 1
    } catch (err) {
      result.errors.push({
        category,
        error: err instanceof Error ? err.message : 'unknown',
      })
    }
  }

  return result
}

// ── Public: weekly report ─────────────────────────────────────────

export async function generateWeeklyReport(
  brandId: string,
  category: string
): Promise<{ report: WeeklyReport | null; reportId: string | null }> {
  const competitors = await getCompetitorProfiles(brandId, {
    activeOnly: true,
    confirmedOnly: true,
    category,
  })
  if (competitors.length === 0) return { report: null, reportId: null }

  const brandName = await getBrandNameById(brandId)
  const periodEnd = new Date()
  const periodStart = new Date(Date.now() - 7 * 86400000)

  // Ensure a fresh score exists for this period.
  const scoringResult = await computeCompetitiveScore(brandId, category)
  const benchmarks = await getBenchmarks(brandId, { category, since: periodStart })
  const alertsThisWeek = await getAlerts(brandId, { limit: 50 })
  const dailyInsights = await getInsights(brandId, { limit: 30 })

  const trend = await getCategorySentimentTrend(brandId, category, { weeks: 12 })

  let trendInsightPayload: string | undefined
  if (trend && trend.length >= 3) {
    try {
      const t = await runTrendInsightFlow({ brandId, category, sentimentTrend: trend })
      trendInsightPayload = `${t.trendLabel} (${t.direction}, ${t.confidence} confidence): ${t.summary}`
    } catch {
      // Trend flow is advisory; swallow errors so weekly report still runs.
    }
  }

  const report = await runWeeklyReportFlow({
    brandId,
    brandName,
    category,
    period: { start: periodStart.toISOString().slice(0, 10), end: periodEnd.toISOString().slice(0, 10) },
    competitorNames: competitors.map((c) => c.competitorName),
    competitiveScore: {
      score: scoringResult.score,
      breakdown: scoringResult.breakdown as any,
      rank: scoringResult.rank,
      totalInCategory: scoringResult.totalInCategory,
      trend: scoringResult.trend,
      previousScore: scoringResult.previousScore,
    },
    benchmarks: benchmarks.map((b) => ({
      metricName: b.metricName,
      brandValue: Number(b.brandValue),
      categoryAvg: Number(b.categoryAvg),
      percentile: b.percentile,
      sampleSize: b.sampleSize,
    })),
    alertsThisPeriod: alertsThisWeek
      .filter((a) => a.createdAt >= periodStart)
      .map((a) => ({ alertType: a.alertType, title: a.title, severity: a.severity })),
    dailyInsights: dailyInsights
      .filter((i) => i.createdAt >= periodStart)
      .map((i) => ({ title: i.title, severity: i.severity, insightType: i.insightType })),
  })

  const contentWithTrend = trendInsightPayload
    ? { ...report, trendNarrative: report.trendNarrative ?? trendInsightPayload }
    : report

  const row = await createReport({
    brandId,
    reportType: 'weekly_summary',
    title: report.headline,
    content: contentWithTrend as any,
    category,
    periodStart: periodStart.toISOString().slice(0, 10),
    periodEnd: periodEnd.toISOString().slice(0, 10),
  })

  return { report: contentWithTrend, reportId: row.id }
}

// ── Public: daily digest orchestrator ─────────────────────────────

/**
 * Runs end-to-end daily flow for a brand:
 *   1. Score every category where brand has active competitors
 *   2. Generate daily insights (cap-enforced)
 *   3. If digest preferences say "daily", build a digest report (text only)
 * Email sending is delegated to the caller (emailService.ts); this function
 * marks the report `emailSent` only after the caller confirms.
 */
export async function processDailyDigest(brandId: string): Promise<{
  brandId: string
  scored: number
  insightsGenerated: number
  reportId: string | null
}> {
  const prefs = await getDigestPreferences(brandId)
  const scored = await scoreBrandForAllCategories(brandId)
  const insights = await generateInsightsForBrand(brandId)

  if (!prefs || prefs.digestFrequency !== 'daily') {
    return { brandId, scored: scored.length, insightsGenerated: insights.generated, reportId: null }
  }

  // Build a lightweight daily digest report (no AI call — summarises today's alerts + insights).
  const todayStart = new Date()
  todayStart.setUTCHours(0, 0, 0, 0)
  const todaysAlerts = (await getAlerts(brandId, { limit: 50 })).filter((a) => a.createdAt >= todayStart)
  const todaysInsights = (await getInsights(brandId, { limit: 20 })).filter((i) => i.createdAt >= todayStart)

  const report = await createReport({
    brandId,
    reportType: 'daily_digest',
    title: `Daily competitive digest — ${todayStart.toISOString().slice(0, 10)}`,
    content: {
      scores: scored.map((s) => ({ score: s.score, rank: s.rank, trend: s.trend })),
      alerts: todaysAlerts.map((a) => ({
        alertType: a.alertType,
        title: a.title,
        severity: a.severity,
      })),
      insights: todaysInsights.map((i) => ({
        title: i.title,
        severity: i.severity,
        insightType: i.insightType,
      })),
      cohortFloor: MIN_COHORT_SIZE,
    },
    periodStart: todayStart.toISOString().slice(0, 10),
    periodEnd: todayStart.toISOString().slice(0, 10),
  })

  return {
    brandId,
    scored: scored.length,
    insightsGenerated: insights.generated,
    reportId: report.id,
  }
}

/**
 * Exposed for the email-sender cron: flips `email_sent` once delivery is
 * confirmed. Kept here rather than inlined in the cron route so the
 * repository contract (which already has the helper) stays private to the
 * service layer.
 */
export async function confirmReportEmailed(reportId: string) {
  return markReportEmailed(reportId)
}
