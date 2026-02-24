import 'server-only'

import { db } from '@/db'
import { feedback, surveyResponses, extractedThemes } from '@/db/schema'
import { eq, gte, and, sql, desc } from 'drizzle-orm'
import { analyzeSentiment } from '@/server/sentimentService'

// ── Types ─────────────────────────────────────────────────────────

export type HealthScoreBreakdown = {
  nps: { score: number; weight: number; weighted: number; detail: string }
  sentiment: { score: number; weight: number; weighted: number; detail: string }
  engagement: { score: number; weight: number; weighted: number; detail: string }
  recency: { score: number; weight: number; weighted: number; detail: string }
  volume: { score: number; weight: number; weighted: number; detail: string }
}

export type ProductHealthResult = {
  productId: string
  healthScore: number // 0-100
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  trend: 'improving' | 'stable' | 'declining'
  breakdown: HealthScoreBreakdown
  dataPoints: number
  lastFeedbackAt: string | null
  computedAt: string
}

// ── Weights ───────────────────────────────────────────────────────

const WEIGHTS = {
  NPS: 0.30,
  SENTIMENT: 0.25,
  ENGAGEMENT: 0.20,
  RECENCY: 0.15,
  VOLUME: 0.10,
} as const

// ── Main function ─────────────────────────────────────────────────

/**
 * Calculate a 0-100 Health Score for a product.
 * 
 * Pulls feedback + survey data, computes a weighted composite score
 * with time decay (recent feedback weighted higher).
 */
export async function calculateProductHealthScore(
  productId: string
): Promise<ProductHealthResult> {
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)

  // ── 1. Gather feedback entries ──────────────────────────────
  const feedbackRows = await db
    .select({
      id: feedback.id,
      feedbackText: feedback.feedbackText,
      normalizedText: feedback.normalizedText,
      rating: feedback.rating,
      sentiment: feedback.sentiment,
      createdAt: feedback.createdAt,
    })
    .from(feedback)
    .where(eq(feedback.productId, productId))
    .orderBy(desc(feedback.createdAt))
    .limit(500)

  // ── 2. Gather survey responses ──────────────────────────────
  const surveyRows = await db
    .select({
      id: surveyResponses.id,
      answers: surveyResponses.answers,
      submittedAt: surveyResponses.submittedAt,
      normalizedText: surveyResponses.normalizedText,
    })
    .from(surveyResponses)
    .where(eq(surveyResponses.productId, productId))
    .orderBy(desc(surveyResponses.submittedAt))
    .limit(500)

  const totalDataPoints = feedbackRows.length + surveyRows.length

  // If no data at all, return a minimal result
  if (totalDataPoints === 0) {
    return buildEmptyResult(productId)
  }

  // ── 3. Compute NPS (0-1 normalized) ─────────────────────────
  const npsResult = computeNPS(surveyRows)

  // ── 4. Compute Sentiment (0-1 normalized) ───────────────────
  const sentimentResult = await computeSentimentScore(feedbackRows, surveyRows)

  // ── 5. Compute Engagement (0-1 normalized) ──────────────────
  const engagementResult = computeEngagement(feedbackRows, surveyRows, thirtyDaysAgo)

  // ── 6. Compute Recency (0-1 normalized, time-decay) ─────────
  const recencyResult = computeRecency(feedbackRows, surveyRows, now)

  // ── 7. Compute Volume (0-1 normalized, log scale) ───────────
  const volumeResult = computeVolume(totalDataPoints)

  // ── 8. Weighted composite ───────────────────────────────────
  const breakdown: HealthScoreBreakdown = {
    nps: {
      score: npsResult.normalized,
      weight: WEIGHTS.NPS,
      weighted: npsResult.normalized * WEIGHTS.NPS,
      detail: `NPS: ${npsResult.raw.toFixed(0)} (${npsResult.promoters}P / ${npsResult.detractors}D)`,
    },
    sentiment: {
      score: sentimentResult.normalized,
      weight: WEIGHTS.SENTIMENT,
      weighted: sentimentResult.normalized * WEIGHTS.SENTIMENT,
      detail: `${sentimentResult.positive} positive, ${sentimentResult.negative} negative, ${sentimentResult.neutral} neutral`,
    },
    engagement: {
      score: engagementResult.normalized,
      weight: WEIGHTS.ENGAGEMENT,
      weighted: engagementResult.normalized * WEIGHTS.ENGAGEMENT,
      detail: `${engagementResult.recentCount} responses in last 30 days`,
    },
    recency: {
      score: recencyResult.normalized,
      weight: WEIGHTS.RECENCY,
      weighted: recencyResult.normalized * WEIGHTS.RECENCY,
      detail: recencyResult.daysSinceLast === 999
        ? 'No recent feedback'
        : `Last feedback ${recencyResult.daysSinceLast} day(s) ago`,
    },
    volume: {
      score: volumeResult.normalized,
      weight: WEIGHTS.VOLUME,
      weighted: volumeResult.normalized * WEIGHTS.VOLUME,
      detail: `${totalDataPoints} total data points`,
    },
  }

  const rawScore = Object.values(breakdown).reduce((sum, b) => sum + b.weighted, 0)
  const healthScore = Math.round(rawScore * 100) // 0-100

  // ── 9. Trend detection (7d vs previous 7d) ──────────────────
  const trend = computeTrend(feedbackRows, surveyRows, sevenDaysAgo, now)

  // ── 10. Grade ───────────────────────────────────────────────
  const grade = healthScore >= 80 ? 'A' :
    healthScore >= 60 ? 'B' :
    healthScore >= 40 ? 'C' :
    healthScore >= 20 ? 'D' : 'F'

  // Find last feedback date
  const allDates = [
    ...feedbackRows.map(r => r.createdAt),
    ...surveyRows.map(r => r.submittedAt),
  ].filter(Boolean).sort((a, b) => new Date(b!).getTime() - new Date(a!).getTime())

  return {
    productId,
    healthScore,
    grade,
    trend,
    breakdown,
    dataPoints: totalDataPoints,
    lastFeedbackAt: allDates[0]?.toISOString() || null,
    computedAt: now.toISOString(),
  }
}

/**
 * Batch compute health scores for multiple products
 */
export async function calculateBatchHealthScores(
  productIds: string[]
): Promise<Map<string, ProductHealthResult>> {
  const results = new Map<string, ProductHealthResult>()
  for (const id of productIds) {
    try {
      results.set(id, await calculateProductHealthScore(id))
    } catch (err) {
      console.error(`[HealthScore] Error for product ${id}:`, err)
      results.set(id, buildEmptyResult(id))
    }
  }
  return results
}

// ── Internal helpers ──────────────────────────────────────────────

function buildEmptyResult(productId: string): ProductHealthResult {
  const empty = { score: 0, weight: 0, weighted: 0, detail: 'No data' }
  return {
    productId,
    healthScore: 0,
    grade: 'F',
    trend: 'stable',
    breakdown: {
      nps: { ...empty, weight: WEIGHTS.NPS },
      sentiment: { ...empty, weight: WEIGHTS.SENTIMENT },
      engagement: { ...empty, weight: WEIGHTS.ENGAGEMENT },
      recency: { ...empty, weight: WEIGHTS.RECENCY },
      volume: { ...empty, weight: WEIGHTS.VOLUME },
    },
    dataPoints: 0,
    lastFeedbackAt: null,
    computedAt: new Date().toISOString(),
  }
}

function computeNPS(surveyRows: Array<{ answers: any }>) {
  let promoters = 0
  let detractors = 0
  let passives = 0

  for (const row of surveyRows) {
    if (!row.answers || typeof row.answers !== 'object') continue
    const answers = row.answers as Record<string, any>

    for (const [key, value] of Object.entries(answers)) {
      if (
        (key.toLowerCase().includes('nps') || key.toLowerCase().includes('recommend')) &&
        typeof value === 'number'
      ) {
        if (value >= 9) promoters++
        else if (value <= 6) detractors++
        else passives++
      }
    }
  }

  const total = promoters + detractors + passives
  const raw = total > 0 ? ((promoters - detractors) / total) * 100 : 0
  // NPS ranges -100 to 100, normalize to 0-1
  const normalized = (raw + 100) / 200

  return { raw, normalized, promoters, detractors, passives }
}

async function computeSentimentScore(
  feedbackRows: Array<{ sentiment: string | null; feedbackText: string; normalizedText: string | null }>,
  surveyRows: Array<{ answers: any; normalizedText: string | null }>
) {
  let positive = 0
  let negative = 0
  let neutral = 0

  // Count from pre-computed feedback sentiment
  for (const row of feedbackRows) {
    if (row.sentiment === 'positive') positive++
    else if (row.sentiment === 'negative') negative++
    else neutral++
  }

  // Analyze survey text responses
  for (const row of surveyRows) {
    const text = row.normalizedText ||
      (row.answers && typeof row.answers === 'object'
        ? Object.values(row.answers as Record<string, any>)
            .filter(v => typeof v === 'string' && v.length > 10)
            .join(' ')
        : '')

    if (text && text.length > 10) {
      const result = await analyzeSentiment(text)
      if (result.sentiment === 'positive') positive++
      else if (result.sentiment === 'negative') negative++
      else neutral++
    }
  }

  const total = positive + negative + neutral
  // Sentiment normalized: ratio of positive out of total, with neutral counting as 0.5
  const normalized = total > 0
    ? (positive + neutral * 0.5) / total
    : 0.5

  return { normalized, positive, negative, neutral }
}

function computeEngagement(
  feedbackRows: Array<{ createdAt: Date }>,
  surveyRows: Array<{ submittedAt: Date | null }>,
  thirtyDaysAgo: Date
) {
  const recentFeedback = feedbackRows.filter(r => r.createdAt >= thirtyDaysAgo).length
  const recentSurveys = surveyRows.filter(r => r.submittedAt && new Date(r.submittedAt) >= thirtyDaysAgo).length
  const recentCount = recentFeedback + recentSurveys

  // Engagement normalized: logarithmic scale, 50+ recent = max
  const normalized = Math.min(Math.log10(recentCount + 1) / Math.log10(51), 1)

  return { normalized, recentCount }
}

function computeRecency(
  feedbackRows: Array<{ createdAt: Date }>,
  surveyRows: Array<{ submittedAt: Date | null }>,
  now: Date
) {
  const allDates = [
    ...feedbackRows.map(r => r.createdAt.getTime()),
    ...surveyRows.map(r => r.submittedAt ? new Date(r.submittedAt).getTime() : 0),
  ].filter(d => d > 0)

  if (allDates.length === 0) {
    return { normalized: 0, daysSinceLast: 999 }
  }

  const mostRecent = Math.max(...allDates)
  const daysSinceLast = Math.floor((now.getTime() - mostRecent) / (1000 * 60 * 60 * 24))

  // Exponential decay: half-life of 7 days
  const normalized = Math.exp(-daysSinceLast / 7)

  return { normalized, daysSinceLast }
}

function computeVolume(totalDataPoints: number) {
  // Log scale: 200+ data points = max score
  const normalized = Math.min(Math.log10(totalDataPoints + 1) / Math.log10(201), 1)
  return { normalized }
}

function computeTrend(
  feedbackRows: Array<{ createdAt: Date; sentiment: string | null }>,
  surveyRows: Array<{ submittedAt: Date | null; answers: any }>,
  sevenDaysAgo: Date,
  now: Date
): 'improving' | 'stable' | 'declining' {
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)

  // Current week sentiment
  const currentWeek = feedbackRows.filter(r => r.createdAt >= sevenDaysAgo)
  const currentPositive = currentWeek.filter(r => r.sentiment === 'positive').length
  const currentTotal = currentWeek.length

  // Previous week sentiment
  const previousWeek = feedbackRows.filter(
    r => r.createdAt >= fourteenDaysAgo && r.createdAt < sevenDaysAgo
  )
  const prevPositive = previousWeek.filter(r => r.sentiment === 'positive').length
  const prevTotal = previousWeek.length

  if (currentTotal < 2 || prevTotal < 2) return 'stable'

  const currentRatio = currentPositive / currentTotal
  const prevRatio = prevPositive / prevTotal
  const change = currentRatio - prevRatio

  if (change > 0.1) return 'improving'
  if (change < -0.1) return 'declining'
  return 'stable'
}
