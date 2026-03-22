import 'server-only'
import type { Product } from '@/lib/types/product'
import type { SurveyResponse } from '@/lib/survey-types'
import type { ProductRankingMetrics, RankingScore } from '@/lib/types/ranking'
import type { ProductCategory } from '@/lib/categories'
import { analyzeSentiment } from '@/server/sentimentService'
import { getSocialProductScore } from '@/server/social/socialAnalyticsService'

/**
 * Shape of a direct feedback record passed into the ranking engine.
 * Avoids importing the full Drizzle schema into this module.
 */
export type DirectFeedbackRecord = {
  id: string
  productId: string
  feedbackText: string | null
  rating: number | null
  sentiment: string | null // 'positive' | 'neutral' | 'negative'
  createdAt: Date | string
}

/**
 * Community engagement stats passed into the ranking engine.
 */
export type CommunityStats = {
  postCount: number
  totalUpvotes: number
  totalReplyCount: number
  watchlistCount: number
}

/**
 * RANKING ALGORITHM CONFIGURATION
 * 
 * Weights must sum to 1.0
 * Updated to include direct feedback ratings and community signals.
 */
const RANKING_WEIGHTS = {
  NPS: 0.18,           // Core satisfaction metric (survey NPS)
  SENTIMENT: 0.15,     // Combined sentiment from surveys + direct feedback
  ENGAGEMENT: 0.14,    // User participation (survey completion + feedback text)
  DIRECT_RATING: 0.13, // Star ratings from direct feedback (1-5)
  VOLUME: 0.10,        // Total data quantity (surveys + direct feedback)
  RECENCY: 0.08,       // Fresh data
  TREND: 0.08,         // Week-over-week improvement
  SOCIAL: 0.08,        // Social listening signals
  COMMUNITY: 0.06,     // Community posts, upvotes, watchlist demand
} as const

/**
 * Minimum data thresholds for ranking eligibility.
 * A product needs enough data from ANY source (surveys OR direct feedback).
 */
const MINIMUM_THRESHOLDS = {
  TOTAL_RESPONSES: 5,         // Minimum total (surveys + direct feedback)
  RECENT_RESPONSES: 3,        // Minimum recent in last 30 days
  DAYS_SINCE_LAST: 30,        // Maximum days since last response
} as const

/**
 * Confidence score multipliers based on data volume
 */
const CONFIDENCE_TIERS = [
  { min: 100, multiplier: 1.0 },
  { min: 50, multiplier: 0.9 },
  { min: 20, multiplier: 0.8 },
  { min: 0, multiplier: 0.5 },
] as const

/**
 * Calculate comprehensive ranking metrics for a product.
 * Now accepts direct feedback records and community stats alongside survey responses.
 */
export async function calculateProductMetrics(
  product: Product,
  responses: SurveyResponse[],
  previousWeekResponses?: SurveyResponse[],
  directFeedback?: DirectFeedbackRecord[],
  previousWeekDirectFeedback?: DirectFeedbackRecord[],
  communityStats?: CommunityStats,
): Promise<ProductRankingMetrics | null> {
  // Ensure product has category
  if (!product.profile?.data?.category) {
    console.warn(`Product ${product.id} has no category, skipping ranking`)
    return null
  }

  const fb = directFeedback ?? []
  const prevFb = previousWeekDirectFeedback ?? []
  const community = communityStats ?? { postCount: 0, totalUpvotes: 0, totalReplyCount: 0, watchlistCount: 0 }

  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  // Filter recent survey responses
  const recentSurveyResponses = responses.filter(r => new Date(r.submittedAt) >= thirtyDaysAgo)
  const weeklySurveyResponses = responses.filter(r => new Date(r.submittedAt) >= sevenDaysAgo)

  // Filter recent direct feedback
  const recentDirectFeedback = fb.filter(f => new Date(f.createdAt) >= thirtyDaysAgo)
  const weeklyDirectFeedback = fb.filter(f => new Date(f.createdAt) >= sevenDaysAgo)

  // Combined counts
  const totalCombined = responses.length + fb.length
  const recentCombined = recentSurveyResponses.length + recentDirectFeedback.length
  const weeklyCombined = weeklySurveyResponses.length + weeklyDirectFeedback.length

  // Check minimum data requirements (surveys + direct feedback combined)
  const hasMinimumData =
    totalCombined >= MINIMUM_THRESHOLDS.TOTAL_RESPONSES &&
    recentCombined >= MINIMUM_THRESHOLDS.RECENT_RESPONSES

  // ── NPS (from surveys only — direct feedback has no NPS question) ──
  const npsScore = calculateNPSFromResponses(responses)

  // ── Sentiment (combined from survey text answers + direct feedback text) ──
  const sentimentData = await calculateCombinedSentiment(responses, fb)

  // ── Direct feedback star rating ──
  const ratedFeedback = fb.filter(f => f.rating !== null && f.rating !== undefined)
  const directRating = ratedFeedback.length > 0
    ? ratedFeedback.reduce((sum, f) => sum + f.rating!, 0) / ratedFeedback.length
    : 0

  // ── Direct feedback sentiment breakdown (pre-computed by DB) ──
  const directSentimentBreakdown = {
    positive: fb.filter(f => f.sentiment === 'positive').length,
    neutral: fb.filter(f => f.sentiment === 'neutral').length,
    negative: fb.filter(f => f.sentiment === 'negative').length,
  }

  // ── Engagement (surveys + direct feedback text richness) ──
  const engagement = calculateCombinedEngagement(responses, fb)

  // ── Recency (most recent across both tables) ──
  const lastSurveyAt = responses.length > 0
    ? responses.reduce((latest, cur) => new Date(cur.submittedAt) > new Date(latest.submittedAt) ? cur : latest).submittedAt
    : null
  const lastFeedbackAt = fb.length > 0
    ? fb.reduce((latest, cur) => new Date(cur.createdAt) > new Date(latest.createdAt) ? cur : latest).createdAt
    : null

  let lastResponseAt: string | null = null
  if (lastSurveyAt && lastFeedbackAt) {
    lastResponseAt = new Date(lastSurveyAt) > new Date(lastFeedbackAt)
      ? String(lastSurveyAt)
      : String(lastFeedbackAt)
  } else {
    lastResponseAt = lastSurveyAt ? String(lastSurveyAt) : (lastFeedbackAt ? String(lastFeedbackAt) : null)
  }

  const daysSinceLastResponse = lastResponseAt
    ? Math.floor((now.getTime() - new Date(lastResponseAt).getTime()) / (1000 * 60 * 60 * 24))
    : 999

  // ── Trend (week-over-week NPS change from surveys; rating change from feedback) ──
  const currentWeekNPS = calculateNPSFromResponses(weeklySurveyResponses)
  const previousWeekNPS = previousWeekResponses ? calculateNPSFromResponses(previousWeekResponses) : null

  // Also factor in direct feedback rating trend
  const currentWeekRatedFb = weeklyDirectFeedback.filter(f => f.rating !== null)
  const prevWeekRatedFb = prevFb.filter(f => f.rating !== null)
  const currentWeekAvgRating = currentWeekRatedFb.length > 0
    ? currentWeekRatedFb.reduce((s, f) => s + f.rating!, 0) / currentWeekRatedFb.length
    : null
  const prevWeekAvgRating = prevWeekRatedFb.length > 0
    ? prevWeekRatedFb.reduce((s, f) => s + f.rating!, 0) / prevWeekRatedFb.length
    : null

  // Blend NPS trend and rating trend
  let weekOverWeekChange = 0
  if (previousWeekNPS !== null && previousWeekNPS !== 0) {
    weekOverWeekChange = ((currentWeekNPS - previousWeekNPS) / Math.abs(previousWeekNPS)) * 100
  }
  if (currentWeekAvgRating !== null && prevWeekAvgRating !== null && prevWeekAvgRating > 0) {
    const ratingChange = ((currentWeekAvgRating - prevWeekAvgRating) / prevWeekAvgRating) * 100
    // Average with NPS change if both exist
    weekOverWeekChange = weekOverWeekChange !== 0
      ? (weekOverWeekChange + ratingChange) / 2
      : ratingChange
  }

  const trendDirection: 'up' | 'down' | 'stable' =
    weekOverWeekChange > 5 ? 'up' :
    weekOverWeekChange < -5 ? 'down' :
    'stable'

  // ── Confidence ──
  const confidenceScore = calculateConfidence(totalCombined, recentCombined, daysSinceLastResponse)

  const result: ProductRankingMetrics = {
    productId: product.id,
    productName: product.name,
    category: product.profile.data.category as ProductCategory,

    npsScore,
    totalResponses: totalCombined,

    sentimentScore: sentimentData.score,
    sentimentBreakdown: sentimentData.breakdown,

    directRating,
    directFeedbackCount: fb.length,
    directSentimentBreakdown,

    surveyCompletionRate: engagement.completionRate,
    feedbackVolume: engagement.feedbackCount,

    communityPostCount: community.postCount,
    communityUpvotes: community.totalUpvotes,
    communityReplyCount: community.totalReplyCount,
    watchlistCount: community.watchlistCount,

    recentResponseCount: weeklyCombined,
    lastResponseAt,

    weekOverWeekChange,
    trendDirection,

    confidenceScore,
    hasMinimumData,

    // Social signals — enriched below
    socialMentions: 0,
    socialSentimentScore: 0,
    socialEngagementScore: 0,
  }

  // Enrich with social data (non-blocking — defaults to 0 if unavailable)
  try {
    const socialScore = await getSocialProductScore(product.id, 30)
    if (socialScore) {
      result.socialMentions = socialScore.totalMentions
      result.socialSentimentScore = socialScore.socialSentimentScore
      result.socialEngagementScore = socialScore.socialEngagementScore
    }
  } catch {
    // Social data unavailable — keep defaults
  }

  return result
}

/**
 * Calculate final ranking score from metrics
 */
export function calculateRankingScore(metrics: ProductRankingMetrics): RankingScore {
  // Normalize each component to 0-1 scale
  
  // 1. NPS Score: -100 to 100 → 0 to 1
  const npsNormalized = (metrics.npsScore + 100) / 200

  // 2. Sentiment Score: already 0 to 1 (combined surveys + direct feedback)
  const sentimentNormalized = metrics.sentimentScore

  // 3. Engagement Score: survey completion + feedback text richness
  const engagementNormalized = (
    metrics.surveyCompletionRate * 0.5 +
    Math.min(metrics.feedbackVolume / 50, 1) * 0.5
  )

  // 4. Direct Rating Score: average star rating 0-5 → 0 to 1
  const directRatingNormalized = metrics.directFeedbackCount > 0
    ? metrics.directRating / 5
    : 0.5 // Neutral when no direct feedback exists

  // 5. Volume Score: logarithmic scale for diminishing returns (combined total)
  const volumeNormalized = Math.min(
    Math.log10(metrics.totalResponses + 1) / Math.log10(1000),
    1
  )

  // 6. Recency Score: exponential decay over 30 days
  const daysSinceLastResponse = metrics.lastResponseAt
    ? Math.floor((Date.now() - new Date(metrics.lastResponseAt).getTime()) / (1000 * 60 * 60 * 24))
    : 30
  const recencyNormalized = Math.exp(-daysSinceLastResponse / 10)

  // 7. Trend Score: week-over-week change bonus
  const trendNormalized = Math.max(0, Math.min(
    0.5 + (metrics.weekOverWeekChange / 200),
    1
  ))

  // 8. Social Score: sentiment + engagement + volume from social listening
  const socialVolumeComponent = Math.min(Math.log10((metrics.socialMentions || 0) + 1) / Math.log10(500), 1)
  const socialNormalized = (
    (metrics.socialSentimentScore || 0) * 0.4 +
    (metrics.socialEngagementScore || 0) * 0.3 +
    socialVolumeComponent * 0.3
  )

  // 9. Community Score: posts, upvotes, replies, watchlist
  const communityPostComponent = Math.min(Math.log10((metrics.communityPostCount || 0) + 1) / Math.log10(100), 1)
  const communityUpvoteComponent = Math.min(Math.log10((metrics.communityUpvotes || 0) + 1) / Math.log10(500), 1)
  const communityReplyComponent = Math.min(Math.log10((metrics.communityReplyCount || 0) + 1) / Math.log10(200), 1)
  const watchlistComponent = Math.min(Math.log10((metrics.watchlistCount || 0) + 1) / Math.log10(100), 1)
  const communityNormalized = (
    communityPostComponent * 0.2 +
    communityUpvoteComponent * 0.3 +
    communityReplyComponent * 0.2 +
    watchlistComponent * 0.3
  )

  // Calculate weighted components
  const breakdown = {
    nps: npsNormalized * RANKING_WEIGHTS.NPS,
    sentiment: sentimentNormalized * RANKING_WEIGHTS.SENTIMENT,
    engagement: engagementNormalized * RANKING_WEIGHTS.ENGAGEMENT,
    directRating: directRatingNormalized * RANKING_WEIGHTS.DIRECT_RATING,
    volume: volumeNormalized * RANKING_WEIGHTS.VOLUME,
    recency: recencyNormalized * RANKING_WEIGHTS.RECENCY,
    trend: trendNormalized * RANKING_WEIGHTS.TREND,
    social: socialNormalized * RANKING_WEIGHTS.SOCIAL,
    community: communityNormalized * RANKING_WEIGHTS.COMMUNITY,
  }

  // Sum all components
  const rawScore = Object.values(breakdown).reduce((sum, val) => sum + val, 0)

  // Apply confidence multiplier
  const confidenceMultiplier = getConfidenceMultiplier(metrics.totalResponses)
  const totalScore = rawScore * confidenceMultiplier

  return {
    productId: metrics.productId,
    totalScore,
    breakdown,
    confidenceMultiplier,
  }
}

/**
 * Helper: Calculate NPS from responses
 */
function calculateNPSFromResponses(responses: SurveyResponse[]): number {
  if (responses.length === 0) return 0

  const scores: number[] = []

  responses.forEach(response => {
    // Find NPS score in answers (typically q_nps_score or similar)
    const npsAnswer = Object.entries(response.answers).find(([key]) => 
      key.toLowerCase().includes('nps') || key.toLowerCase().includes('recommend')
    )

    if (npsAnswer && typeof npsAnswer[1] === 'number') {
      scores.push(Number(npsAnswer[1]))
    }
  })

  if (scores.length === 0) return 0

  const promoters = scores.filter(s => s >= 9).length
  const detractors = scores.filter(s => s <= 6).length
  
  return ((promoters - detractors) / scores.length) * 100
}

/**
 * Helper: Calculate sentiment from survey text AND direct feedback text (combined)
 */
async function calculateCombinedSentiment(
  responses: SurveyResponse[],
  directFeedback: DirectFeedbackRecord[]
): Promise<{
  score: number
  breakdown: { positive: number; neutral: number; negative: number }
}> {
  // 1. Collect text from survey answers
  const textResponses: string[] = []
  responses.forEach(response => {
    Object.entries(response.answers).forEach(([_, answer]) => {
      if (typeof answer === 'string' && answer.length > 10) {
        textResponses.push(answer)
      }
    })
  })

  // 2. For direct feedback — use pre-computed sentiment when available, else queue for analysis
  const directTexts: string[] = []
  let directPositive = 0
  let directNeutral = 0
  let directNegative = 0

  for (const fb of directFeedback) {
    if (fb.sentiment) {
      // Already analyzed at submission time
      if (fb.sentiment === 'positive') directPositive++
      else if (fb.sentiment === 'negative') directNegative++
      else directNeutral++
    } else if (fb.feedbackText && fb.feedbackText.length > 10) {
      // Queue for analysis
      directTexts.push(fb.feedbackText)
    }
  }

  // 3. Batch-analyze all un-analyzed text (surveys + any direct feedback without sentiment)
  const allTexts = [...textResponses, ...directTexts]
  if (allTexts.length === 0 && directPositive + directNeutral + directNegative === 0) {
    return { score: 0.5, breakdown: { positive: 0, neutral: 0, negative: 0 } }
  }

  let surveyPositive = 0
  let surveyNeutral = 0
  let surveyNegative = 0

  if (allTexts.length > 0) {
    const sentiments = await Promise.all(
      allTexts.map(text => analyzeSentiment(text))
    )
    surveyPositive = sentiments.filter(s => s.sentiment === 'positive').length
    surveyNeutral = sentiments.filter(s => s.sentiment === 'neutral').length
    surveyNegative = sentiments.filter(s => s.sentiment === 'negative').length
  }

  const breakdown = {
    positive: surveyPositive + directPositive,
    neutral: surveyNeutral + directNeutral,
    negative: surveyNegative + directNegative,
  }

  const total = breakdown.positive + breakdown.neutral + breakdown.negative
  const score = total > 0 ? breakdown.positive / total : 0.5

  return { score, breakdown }
}

/**
 * Helper: Calculate engagement from surveys + direct feedback combined
 */
function calculateCombinedEngagement(
  responses: SurveyResponse[],
  directFeedback: DirectFeedbackRecord[]
): {
  completionRate: number
  feedbackCount: number
} {
  // Survey completion rate
  let completionRate = 0
  if (responses.length > 0) {
    const avgQuestionsAnswered = responses.reduce((sum, r) =>
      sum + Object.keys(r.answers).length, 0
    ) / responses.length
    completionRate = Math.min(avgQuestionsAnswered / 3, 1)
  }

  // Count text-rich feedback across both sources
  const surveyTextCount = responses.filter(r =>
    Object.values(r.answers).some(a => typeof a === 'string' && a.length > 20)
  ).length

  const directTextCount = directFeedback.filter(f =>
    f.feedbackText && f.feedbackText.length > 20
  ).length

  return {
    completionRate,
    feedbackCount: surveyTextCount + directTextCount,
  }
}

/**
 * Helper: Calculate confidence score
 */
function calculateConfidence(
  totalResponses: number,
  recentResponses: number,
  daysSinceLastResponse: number
): number {
  // Volume confidence: 0 to 1 based on total responses
  const volumeConfidence = Math.min(totalResponses / 100, 1)

  // Recency confidence: 0 to 1 based on recent activity
  const recencyConfidence = Math.max(0, 1 - (daysSinceLastResponse / 30))

  // Activity confidence: recent responses vs total
  const activityConfidence = totalResponses > 0 
    ? recentResponses / Math.min(totalResponses, 20)
    : 0

  // Weighted average
  return (volumeConfidence * 0.5 + recencyConfidence * 0.3 + activityConfidence * 0.2)
}

/**
 * Helper: Get confidence multiplier based on volume
 */
function getConfidenceMultiplier(totalResponses: number): number {
  for (const tier of CONFIDENCE_TIERS) {
    if (totalResponses >= tier.min) {
      return tier.multiplier
    }
  }
  return 0.5
}

/**
 * Filter products eligible for ranking
 */
export function filterEligibleProducts(metrics: ProductRankingMetrics[]): ProductRankingMetrics[] {
  return metrics.filter(m => 
    m.hasMinimumData &&
    m.totalResponses >= MINIMUM_THRESHOLDS.TOTAL_RESPONSES &&
    m.recentResponseCount >= MINIMUM_THRESHOLDS.RECENT_RESPONSES
  )
}

/**
 * Generate top N rankings from scored products
 */
export function generateTopRankings(
  scores: RankingScore[],
  metrics: ProductRankingMetrics[],
  topN: number = 10
): Array<{
  rank: number
  productId: string
  productName: string
  score: number
  metrics: ProductRankingMetrics
  scoreBreakdown: RankingScore['breakdown']
}> {
  // Sort by total score descending
  const sorted = [...scores].sort((a, b) => b.totalScore - a.totalScore)

  // Take top N
  const topScores = sorted.slice(0, topN)

  // Combine with metrics
  return topScores.map((score, index) => {
    const metric = metrics.find(m => m.productId === score.productId)!
    
    return {
      rank: index + 1,
      productId: score.productId,
      productName: metric.productName,
      score: score.totalScore,
      metrics: metric,
      scoreBreakdown: score.breakdown,
    }
  })
}
