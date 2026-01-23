import 'server-only'
import type { Product } from '@/lib/types/product'
import type { SurveyResponse } from '@/lib/survey-types'
import type { ProductRankingMetrics, RankingScore } from '@/lib/types/ranking'
import type { ProductCategory } from '@/lib/categories'
import { analyzeSentiment } from '@/server/sentimentService'

/**
 * RANKING ALGORITHM CONFIGURATION
 * 
 * Weights must sum to 1.0
 */
const RANKING_WEIGHTS = {
  NPS: 0.25,           // Core satisfaction metric
  SENTIMENT: 0.20,     // Feedback quality
  ENGAGEMENT: 0.20,    // User participation
  VOLUME: 0.15,        // Data quantity
  RECENCY: 0.10,       // Fresh data
  TREND: 0.10,         // Week-over-week improvement
} as const

/**
 * Minimum data thresholds for ranking eligibility
 */
const MINIMUM_THRESHOLDS = {
  TOTAL_RESPONSES: 0,         // Minimum responses to be ranked (set to 0 for testing)
  RECENT_RESPONSES: 0,        // Minimum responses in last 30 days (set to 0 for testing)
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
 * Calculate comprehensive ranking metrics for a product
 */
export async function calculateProductMetrics(
  product: Product,
  responses: SurveyResponse[],
  previousWeekResponses?: SurveyResponse[]
): Promise<ProductRankingMetrics | null> {
  // Ensure product has category
  if (!product.profile?.data?.category) {
    console.warn(`Product ${product.id} has no category, skipping ranking`)
    return null
  }

  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  // Filter recent responses
  const recentResponses = responses.filter(r => {
    const submittedAt = new Date(r.submittedAt)
    return submittedAt >= thirtyDaysAgo
  })

  const weeklyResponses = responses.filter(r => {
    const submittedAt = new Date(r.submittedAt)
    return submittedAt >= sevenDaysAgo
  })

  // Check minimum data requirements
  const hasMinimumData = 
    responses.length >= MINIMUM_THRESHOLDS.TOTAL_RESPONSES &&
    recentResponses.length >= MINIMUM_THRESHOLDS.RECENT_RESPONSES

  // Calculate NPS score
  const npsScore = calculateNPSFromResponses(responses)

  // Calculate sentiment
  const sentimentData = await calculateSentiment(responses)

  // Calculate engagement
  const engagement = calculateEngagement(responses)

  // Calculate recency
  const lastResponse = responses.length > 0
    ? responses.reduce((latest, current) => 
        new Date(current.submittedAt) > new Date(latest.submittedAt) ? current : latest
      )
    : null

  const daysSinceLastResponse = lastResponse
    ? Math.floor((now.getTime() - new Date(lastResponse.submittedAt).getTime()) / (1000 * 60 * 60 * 24))
    : 999

  // Calculate week-over-week trend
  const currentWeekNPS = calculateNPSFromResponses(weeklyResponses)
  const previousWeekNPS = previousWeekResponses ? calculateNPSFromResponses(previousWeekResponses) : null
  
  const weekOverWeekChange = previousWeekNPS !== null && previousWeekNPS !== 0
    ? ((currentWeekNPS - previousWeekNPS) / Math.abs(previousWeekNPS)) * 100
    : 0

  const trendDirection: 'up' | 'down' | 'stable' = 
    weekOverWeekChange > 5 ? 'up' :
    weekOverWeekChange < -5 ? 'down' :
    'stable'

  // Calculate confidence score
  const confidenceScore = calculateConfidence(
    responses.length,
    recentResponses.length,
    daysSinceLastResponse
  )

  return {
    productId: product.id,
    productName: product.name,
    category: product.profile.data.category as ProductCategory,
    
    npsScore,
    totalResponses: responses.length,
    
    sentimentScore: sentimentData.score,
    sentimentBreakdown: sentimentData.breakdown,
    
    surveyCompletionRate: engagement.completionRate,
    feedbackVolume: engagement.feedbackCount,
    
    recentResponseCount: weeklyResponses.length,
    lastResponseAt: lastResponse?.submittedAt || null,
    
    weekOverWeekChange,
    trendDirection,
    
    confidenceScore,
    hasMinimumData,
  }
}

/**
 * Calculate final ranking score from metrics
 */
export function calculateRankingScore(metrics: ProductRankingMetrics): RankingScore {
  // Normalize each component to 0-1 scale
  
  // 1. NPS Score: -100 to 100 → 0 to 1
  const npsNormalized = (metrics.npsScore + 100) / 200

  // 2. Sentiment Score: already 0 to 1
  const sentimentNormalized = metrics.sentimentScore

  // 3. Engagement Score: combination of completion rate and feedback volume
  const engagementNormalized = (
    metrics.surveyCompletionRate * 0.6 +
    Math.min(metrics.feedbackVolume / 50, 1) * 0.4
  )

  // 4. Volume Score: logarithmic scale for diminishing returns
  const volumeNormalized = Math.min(
    Math.log10(metrics.totalResponses + 1) / Math.log10(1000),
    1
  )

  // 5. Recency Score: exponential decay over 30 days
  const daysSinceLastResponse = metrics.lastResponseAt
    ? Math.floor((Date.now() - new Date(metrics.lastResponseAt).getTime()) / (1000 * 60 * 60 * 24))
    : 30

  const recencyNormalized = Math.exp(-daysSinceLastResponse / 10)

  // 6. Trend Score: week-over-week change bonus
  const trendNormalized = Math.max(0, Math.min(
    0.5 + (metrics.weekOverWeekChange / 200), // -100% to +100% maps to 0 to 1
    1
  ))

  // Calculate weighted components
  const breakdown = {
    nps: npsNormalized * RANKING_WEIGHTS.NPS,
    sentiment: sentimentNormalized * RANKING_WEIGHTS.SENTIMENT,
    engagement: engagementNormalized * RANKING_WEIGHTS.ENGAGEMENT,
    volume: volumeNormalized * RANKING_WEIGHTS.VOLUME,
    recency: recencyNormalized * RANKING_WEIGHTS.RECENCY,
    trend: trendNormalized * RANKING_WEIGHTS.TREND,
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
 * Helper: Calculate sentiment from text responses
 */
async function calculateSentiment(responses: SurveyResponse[]): Promise<{
  score: number
  breakdown: { positive: number; neutral: number; negative: number }
}> {
  const textResponses: string[] = []

  responses.forEach(response => {
    Object.entries(response.answers).forEach(([_, answer]) => {
      if (typeof answer === 'string' && answer.length > 10) {
        textResponses.push(answer)
      }
    })
  })

  if (textResponses.length === 0) {
    return { score: 0.5, breakdown: { positive: 0, neutral: 0, negative: 0 } }
  }

  // Batch analyze sentiment
  const sentiments = await Promise.all(
    textResponses.map(text => analyzeSentiment(text))
  )

  const breakdown = {
    positive: sentiments.filter(s => s.sentiment === 'positive').length,
    neutral: sentiments.filter(s => s.sentiment === 'neutral').length,
    negative: sentiments.filter(s => s.sentiment === 'negative').length,
  }

  // Calculate overall sentiment score (0 to 1)
  const score = breakdown.positive / sentiments.length

  return { score, breakdown }
}

/**
 * Helper: Calculate engagement metrics
 */
function calculateEngagement(responses: SurveyResponse[]): {
  completionRate: number
  feedbackCount: number
} {
  if (responses.length === 0) {
    return { completionRate: 0, feedbackCount: 0 }
  }

  // Calculate completion rate based on number of questions answered
  const avgQuestionsAnswered = responses.reduce((sum, r) => 
    sum + Object.keys(r.answers).length, 0
  ) / responses.length

  // Assume 2-3 questions per survey
  const completionRate = Math.min(avgQuestionsAnswered / 3, 1)

  // Count text feedback
  const feedbackCount = responses.filter(r => 
    Object.values(r.answers).some(a => typeof a === 'string' && a.length > 20)
  ).length

  return { completionRate, feedbackCount }
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
