import type { ProductCategory } from '../categories'

/**
 * Ranking metric data for a single product
 */
export type ProductRankingMetrics = {
  productId: string
  productName: string
  category: ProductCategory
  
  // Core metrics
  npsScore: number // -100 to 100
  totalResponses: number
  
  // Sentiment
  sentimentScore: number // 0 to 1 (percentage positive)
  sentimentBreakdown: {
    positive: number
    neutral: number
    negative: number
  }
  
  // Engagement
  surveyCompletionRate: number // 0 to 1
  feedbackVolume: number
  
  // Recency
  recentResponseCount: number // Last 7 days
  lastResponseAt: string | null
  
  // Trend
  weekOverWeekChange: number // Percentage change from last week
  trendDirection: 'up' | 'down' | 'stable'
  
  // Confidence
  confidenceScore: number // 0 to 1
  hasMinimumData: boolean
}

/**
 * Calculated ranking score
 */
export type RankingScore = {
  productId: string
  totalScore: number // Final weighted score
  breakdown: {
    nps: number
    sentiment: number
    engagement: number
    volume: number
    recency: number
    trend: number
  }
  confidenceMultiplier: number
}

/**
 * Single ranking entry
 */
export type RankingEntry = {
  rank: number // 1-10
  productId: string
  productName: string
  score: number
  metrics: {
    npsScore: number
    sentimentScore: number
    totalResponses: number
    trendDirection: 'up' | 'down' | 'stable'
    weekOverWeekChange: number
  }
}

/**
 * Ranked product with full details
 */
export type RankedProduct = {
  productId: string
  productName: string
  rankingScore: number
  metrics: ProductRankingMetrics
  previousRank: number | null
}

/**
 * Weekly ranking snapshot
 */
export type WeeklyRanking = {
  id: string
  weekStart: string // ISO date (Monday)
  weekEnd: string // ISO date (Sunday)
  category: ProductCategory
  categoryName: string
  rankings: RankingEntry[]
  products: RankedProduct[] // Full product details for email notifications
  generatedAt: string
  totalProductsEvaluated: number
}

/**
 * Ranking history for a product
 */
export type ProductRankingHistory = {
  productId: string
  category: ProductCategory
  history: Array<{
    weekStart: string
    rank: number | null // null if not in top 10
    score: number
    totalInCategory: number
  }>
}

/**
 * User notification preferences for rankings
 */
export type RankingNotificationPreferences = {
  userId: string
  interestedCategories: ProductCategory[]
  notificationChannels: ('email' | 'in-app' | 'whatsapp')[]
  frequency: 'weekly' | 'bi-weekly' | 'never'
}

/**
 * Brand notification payload
 */
export type BrandRankingNotification = {
  type: 'new_entry' | 'rank_change' | 'milestone'
  productId: string
  productName: string
  category: ProductCategory
  currentRank: number
  previousRank: number | null
  score: number
  weekStart: string
  message: string
}
