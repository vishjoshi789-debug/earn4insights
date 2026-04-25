import 'server-only'

/**
 * Competitive Scoring Service
 *
 * Computes a 0-100 competitive score for a brand within a category across
 * six weighted dimensions, then persists benchmarks and the overall score.
 *
 * Weights (must sum to 100):
 *   sentiment         25   — category-relative avg rating / sentiment mix
 *   marketShare       20   — share of feedback volume within category
 *   pricing           15   — proximity to category median price (lower = penalty if far)
 *   featureCoverage   15   — distinct feedback categories covered vs category max
 *   influencerReach   10   — approved influencer posts tagging brand
 *   consumerLoyalty   15   — repeat-feedback ratio (proxy — real CRM data unavailable)
 *
 * Privacy discipline
 * ──────────────────
 * All consumer-derived dimensions read through repository aggregate helpers,
 * which enforce MIN_COHORT_SIZE = 5 and return null when the cohort is too
 * small. A null dimension contributes 0 to the score AND its weight is
 * removed from the denominator — the brand is not penalised for lack of
 * data (normalise upward, same pattern as ICP scoring).
 *
 * If the total available weight is below 40 (too little data to score
 * meaningfully), the function returns `{ score: null, reason: 'insufficient_data' }`
 * and does NOT persist a score row. This protects against misleading
 * "5/100" scores driven by 5% effective data.
 */

import { db } from '@/db'
import { products, feedback, influencerContentPosts } from '@/db/schema'
import { eq, and, inArray, sql as drizzleSql } from 'drizzle-orm'
import {
  getAggregatedSentiment,
  getFeedbackThemes,
  getCompetitiveScore,
  upsertCompetitiveScore,
  upsertBenchmark,
  getCompetitorProfiles,
  MIN_COHORT_SIZE,
} from '@/db/repositories/competitiveIntelligenceRepository'

// ── Types ─────────────────────────────────────────────────────────

export const DIMENSION_WEIGHTS = {
  sentiment: 25,
  marketShare: 20,
  pricing: 15,
  featureCoverage: 15,
  influencerReach: 10,
  consumerLoyalty: 15,
} as const

type DimensionName = keyof typeof DIMENSION_WEIGHTS

export type ScoringDimensionResult = {
  score: number | null      // 0-100 or null if cohort too small
  rawValue: number | null
  categoryAvg: number | null
  sampleSize: number
}

export type CompetitiveScoringResult = {
  score: number | null
  reason?: 'insufficient_data'
  breakdown: Record<DimensionName, { score: number; weight: number }>
  dimensions: Record<DimensionName, ScoringDimensionResult>
  rank: number
  totalInCategory: number
  trend: 'improving' | 'stable' | 'declining'
  previousScore: number | null
  effectiveWeight: number
}

const INSUFFICIENT_WEIGHT_THRESHOLD = 40
const TREND_DELTA = 3          // points; below this → 'stable'
const LOOKBACK_DAYS = 30

// ── Helpers ───────────────────────────────────────────────────────

async function getProductIdsForBrand(brandId: string): Promise<string[]> {
  const rows = await db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.ownerId, brandId), eq(products.lifecycleStatus, 'verified')))
  return rows.map((r) => r.id)
}

async function getProductIdsInCategory(category: string): Promise<string[]> {
  const rows = await db
    .select({ id: products.id })
    .from(products)
    .where(drizzleSql`${products.profile}->>'category' = ${category}`)
  return rows.map((r) => r.id)
}

function normalise(value: number, min: number, max: number): number {
  if (max === min) return 50
  const n = ((value - min) / (max - min)) * 100
  return Math.max(0, Math.min(100, Math.round(n)))
}

// ── Dimension scorers ─────────────────────────────────────────────

async function scoreSentiment(
  brandId: string,
  brandProductIds: string[],
  categoryProductIds: string[],
  since: Date
): Promise<ScoringDimensionResult> {
  const brand = await getAggregatedSentiment(brandId, brandProductIds, { since })
  const cat = await getAggregatedSentiment(brandId, categoryProductIds, { since })

  if (!brand || !cat || brand.avgRating === null || cat.avgRating === null) {
    return { score: null, rawValue: brand?.avgRating ?? null, categoryAvg: cat?.avgRating ?? null, sampleSize: brand?.cohortSize ?? 0 }
  }

  // Map 1-5 rating → 0-100. Brand rating vs category avg as the delta signal.
  const brandPct = ((brand.avgRating - 1) / 4) * 100
  const catPct = ((cat.avgRating - 1) / 4) * 100
  const score = normalise(brandPct - catPct + 50, 0, 100)

  return { score, rawValue: brand.avgRating, categoryAvg: cat.avgRating, sampleSize: brand.cohortSize }
}

async function scoreMarketShare(
  brandProductIds: string[],
  categoryProductIds: string[]
): Promise<ScoringDimensionResult> {
  if (categoryProductIds.length === 0) {
    return { score: null, rawValue: null, categoryAvg: null, sampleSize: 0 }
  }

  const [brandRow, catRow] = await Promise.all([
    db
      .select({ n: drizzleSql<number>`count(*)::int` })
      .from(feedback)
      .where(brandProductIds.length > 0 ? inArray(feedback.productId, brandProductIds) : drizzleSql`false`),
    db
      .select({ n: drizzleSql<number>`count(*)::int` })
      .from(feedback)
      .where(inArray(feedback.productId, categoryProductIds)),
  ])

  const brandVol = brandRow[0]?.n ?? 0
  const catVol = catRow[0]?.n ?? 0

  if (catVol < MIN_COHORT_SIZE) {
    return { score: null, rawValue: brandVol, categoryAvg: null, sampleSize: catVol }
  }

  const sharePct = (brandVol / catVol) * 100
  // Anything ≥ 40% share → 100. Log scale below that so small brands get meaningful separation.
  const score = sharePct >= 40 ? 100 : Math.round((Math.log10(sharePct + 1) / Math.log10(41)) * 100)

  return { score, rawValue: sharePct, categoryAvg: 100, sampleSize: catVol }
}

async function scorePricing(
  brandProductIds: string[],
  categoryProductIds: string[]
): Promise<ScoringDimensionResult> {
  if (brandProductIds.length === 0 || categoryProductIds.length === 0) {
    return { score: null, rawValue: null, categoryAvg: null, sampleSize: 0 }
  }

  // No price on products table — pricing comes from competitor_products.
  // For scoring purposes, compare avg of brand competitor-tracked prices
  // to category median (competitor_products.current_price). Null-safe.
  const rows = await db.execute<{ brand_avg: number | null; cat_median: number | null; n: number }>(drizzleSql`
    WITH brand_prices AS (
      SELECT avg(current_price)::float AS v
      FROM competitor_products
      WHERE product_id = ANY(${brandProductIds}) AND current_price IS NOT NULL
    ),
    cat_prices AS (
      SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY current_price)::float AS v,
             count(*)::int AS n
      FROM competitor_products
      WHERE product_id = ANY(${categoryProductIds}) AND current_price IS NOT NULL
    )
    SELECT
      (SELECT v FROM brand_prices) AS brand_avg,
      (SELECT v FROM cat_prices) AS cat_median,
      (SELECT n FROM cat_prices) AS n
  `)

  const r: any = Array.isArray(rows) ? rows[0] : (rows as any).rows?.[0]
  const brandAvg = r?.brand_avg ? Number(r.brand_avg) : null
  const catMedian = r?.cat_median ? Number(r.cat_median) : null
  const n = Number(r?.n ?? 0)

  if (!brandAvg || !catMedian || n < MIN_COHORT_SIZE) {
    return { score: null, rawValue: brandAvg, categoryAvg: catMedian, sampleSize: n }
  }

  // Proximity to median is rewarded; being ±50% gets ~50 score.
  const deltaPct = Math.abs((brandAvg - catMedian) / catMedian) * 100
  const score = Math.max(0, Math.round(100 - deltaPct))
  return { score, rawValue: brandAvg, categoryAvg: catMedian, sampleSize: n }
}

async function scoreFeatureCoverage(
  brandId: string,
  brandProductIds: string[],
  categoryProductIds: string[],
  since: Date
): Promise<ScoringDimensionResult> {
  const brand = await getFeedbackThemes(brandId, brandProductIds, { since, limit: 50 })
  const cat = await getFeedbackThemes(brandId, categoryProductIds, { since, limit: 50 })
  if (!brand || !cat) {
    return { score: null, rawValue: brand?.length ?? null, categoryAvg: cat?.length ?? null, sampleSize: brand?.length ?? 0 }
  }
  if (cat.length === 0) return { score: 50, rawValue: brand.length, categoryAvg: 0, sampleSize: brand.length }
  const score = Math.round((brand.length / cat.length) * 100)
  return { score: Math.min(100, score), rawValue: brand.length, categoryAvg: cat.length, sampleSize: brand.length }
}

async function scoreInfluencerReach(
  brandId: string,
  since: Date
): Promise<ScoringDimensionResult> {
  const rows = await db
    .select({ n: drizzleSql<number>`count(*)::int` })
    .from(influencerContentPosts)
    .where(
      and(
        eq(influencerContentPosts.brandId, brandId),
        eq(influencerContentPosts.status, 'published'),
        drizzleSql`${influencerContentPosts.publishedAt} >= ${since}`
      )
    )
  const n = rows[0]?.n ?? 0
  // Cap at 50 posts → 100.
  const score = Math.min(100, Math.round((n / 50) * 100))
  return { score, rawValue: n, categoryAvg: null, sampleSize: n }
}

async function scoreConsumerLoyalty(
  brandId: string,
  brandProductIds: string[]
): Promise<ScoringDimensionResult> {
  if (brandProductIds.length === 0) {
    return { score: null, rawValue: null, categoryAvg: null, sampleSize: 0 }
  }

  // Proxy for loyalty: ratio of repeat feedback (users with > 1 feedback) to total unique users.
  const rows = await db.execute<{ unique_users: number; repeat_users: number }>(drizzleSql`
    WITH user_counts AS (
      SELECT user_email, count(*)::int AS c
      FROM feedback
      WHERE product_id = ANY(${brandProductIds}) AND user_email IS NOT NULL
      GROUP BY user_email
    )
    SELECT
      count(*)::int AS unique_users,
      count(*) FILTER (WHERE c > 1)::int AS repeat_users
    FROM user_counts
  `)
  const r: any = Array.isArray(rows) ? rows[0] : (rows as any).rows?.[0]
  const unique = Number(r?.unique_users ?? 0)
  const repeat = Number(r?.repeat_users ?? 0)
  if (unique < MIN_COHORT_SIZE) {
    return { score: null, rawValue: null, categoryAvg: null, sampleSize: unique }
  }
  const ratio = repeat / unique
  const score = Math.round(ratio * 100)
  return { score, rawValue: ratio, categoryAvg: null, sampleSize: unique }
}

// ── Orchestration ─────────────────────────────────────────────────

export async function computeCompetitiveScore(
  brandId: string,
  category: string
): Promise<CompetitiveScoringResult> {
  const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000)

  const [brandProductIds, categoryProductIds] = await Promise.all([
    getProductIdsForBrand(brandId),
    getProductIdsInCategory(category),
  ])

  const [sentiment, marketShare, pricing, featureCoverage, influencerReach, consumerLoyalty] =
    await Promise.all([
      scoreSentiment(brandId, brandProductIds, categoryProductIds, since),
      scoreMarketShare(brandProductIds, categoryProductIds),
      scorePricing(brandProductIds, categoryProductIds),
      scoreFeatureCoverage(brandId, brandProductIds, categoryProductIds, since),
      scoreInfluencerReach(brandId, since),
      scoreConsumerLoyalty(brandId, brandProductIds),
    ])

  const dimensions: Record<DimensionName, ScoringDimensionResult> = {
    sentiment,
    marketShare,
    pricing,
    featureCoverage,
    influencerReach,
    consumerLoyalty,
  }

  // Normalise upward: drop weights of null dimensions.
  let totalEarned = 0
  let totalWeight = 0
  const breakdown: Record<DimensionName, { score: number; weight: number }> = {} as any
  for (const [name, weight] of Object.entries(DIMENSION_WEIGHTS) as [DimensionName, number][]) {
    const d = dimensions[name]
    if (d.score !== null) {
      totalEarned += (d.score / 100) * weight
      totalWeight += weight
      breakdown[name] = { score: d.score, weight }
    } else {
      breakdown[name] = { score: 0, weight: 0 }
    }
  }

  if (totalWeight < INSUFFICIENT_WEIGHT_THRESHOLD) {
    return {
      score: null,
      reason: 'insufficient_data',
      breakdown,
      dimensions,
      rank: 0,
      totalInCategory: 0,
      trend: 'stable',
      previousScore: null,
      effectiveWeight: totalWeight,
    }
  }

  const score = Math.round((totalEarned / totalWeight) * 100)

  // Trend: compare with previously persisted score for same (brand, category).
  const existing = await getCompetitiveScore(brandId, category)
  const previousScore = existing?.overallScore ?? null
  let trend: 'improving' | 'stable' | 'declining' = 'stable'
  if (previousScore !== null) {
    const delta = score - previousScore
    if (delta >= TREND_DELTA) trend = 'improving'
    else if (delta <= -TREND_DELTA) trend = 'declining'
  }

  // Rank: count rows in competitive_scores for category with higher score + 1.
  const rankRow = await db
    .select({ n: drizzleSql<number>`count(*)::int` })
    .from(
      // inline import avoid: use drizzle table directly
      (await import('@/db/schema')).competitiveScores as any
    )
    .where(
      and(
        drizzleSql`category = ${category}`,
        drizzleSql`brand_id != ${brandId}`,
        drizzleSql`overall_score > ${score}`
      )
    )
  const higherCount = rankRow[0]?.n ?? 0
  const totalRow = await db
    .select({ n: drizzleSql<number>`count(*)::int` })
    .from((await import('@/db/schema')).competitiveScores as any)
    .where(drizzleSql`category = ${category}`)
  const totalInCategory = (totalRow[0]?.n ?? 0) + 1          // +1 for self row we are about to upsert
  const rank = higherCount + 1

  // Persist score.
  await upsertCompetitiveScore({
    brandId,
    category,
    overallScore: score,
    scoreBreakdown: breakdown,
    rank,
    totalInCategory,
    trend,
    previousScore,
  })

  // Persist benchmarks per dimension (only those with a score).
  const today = new Date()
  const periodStartDate = new Date(since.toISOString().slice(0, 10))
  for (const [name, result] of Object.entries(dimensions) as [DimensionName, ScoringDimensionResult][]) {
    if (result.score === null || result.rawValue === null) continue
    await upsertBenchmark({
      brandId,
      category,
      metricName: dimensionToMetricName(name),
      brandValue: String(result.rawValue),
      categoryAvg: String(result.categoryAvg ?? result.rawValue),
      percentile: result.score,
      sampleSize: result.sampleSize,
      periodStart: periodStartDate.toISOString().slice(0, 10),
      periodEnd: today.toISOString().slice(0, 10),
    })
  }

  return {
    score,
    breakdown,
    dimensions,
    rank,
    totalInCategory,
    trend,
    previousScore,
    effectiveWeight: totalWeight,
  }
}

function dimensionToMetricName(name: DimensionName): string {
  switch (name) {
    case 'sentiment': return 'avg_sentiment'
    case 'marketShare': return 'market_share'
    case 'pricing': return 'avg_price'
    case 'featureCoverage': return 'feature_coverage'
    case 'influencerReach': return 'influencer_reach'
    case 'consumerLoyalty': return 'consumer_loyalty'
  }
}

/**
 * Batch entrypoint used by cron: score every (brand, category) pair for brands
 * that have at least one confirmed active competitor. Brands without active
 * competitors are skipped (AI cost protection + no signal to compare against).
 */
export async function scoreBrandForAllCategories(brandId: string): Promise<CompetitiveScoringResult[]> {
  const profiles = await getCompetitorProfiles(brandId, { activeOnly: true, confirmedOnly: true })
  const categories = Array.from(new Set(profiles.map((p) => p.category))).filter(Boolean)
  if (categories.length === 0) return []
  const results: CompetitiveScoringResult[] = []
  for (const cat of categories) {
    results.push(await computeCompetitiveScore(brandId, cat))
  }
  return results
}
