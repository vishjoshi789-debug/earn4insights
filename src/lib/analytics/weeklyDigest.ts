import 'server-only'

import { db } from '@/db'
import { feedback, surveyResponses, extractedThemes, products } from '@/db/schema'
import { eq, desc, gte, and, lt, sql } from 'drizzle-orm'
import { analyzeSentiment } from '@/server/sentimentService'

// ── Types ─────────────────────────────────────────────────────────

export type DigestAlert = {
  type: 'sentiment_drop' | 'volume_spike' | 'emerging_theme' | 'recurring_issue'
  severity: 'high' | 'medium' | 'low'
  title: string
  description: string
  productId?: string
  productName?: string
}

export type DigestProductSummary = {
  productId: string
  productName: string
  feedbackThisWeek: number
  feedbackLastWeek: number
  volumeChange: number // percentage
  sentimentThisWeek: number // -1 to 1
  sentimentLastWeek: number
  sentimentChange: number
  topThemes: string[]
}

export type WeeklyDigestResult = {
  weekStart: string
  weekEnd: string
  alerts: DigestAlert[]
  productSummaries: DigestProductSummary[]
  overallStats: {
    totalFeedbackThisWeek: number
    totalFeedbackLastWeek: number
    volumeChange: number
    avgSentimentThisWeek: number
    avgSentimentLastWeek: number
    sentimentChange: number
    newThemesCount: number
  }
  generatedAt: string
}

// ── Main function ─────────────────────────────────────────────────

/**
 * Generate a weekly digest for a brand owner.
 * Compares this week vs last week: sentiment shifts, volume changes,
 * recurring themes, emerging complaints.
 *
 * @param brandOwnerId - The user ID of the brand owner (to scope products)
 */
export async function generateWeeklyDigest(
  brandOwnerId: string
): Promise<WeeklyDigestResult> {
  const now = new Date()
  const weekStart = new Date(now)
  weekStart.setDate(weekStart.getDate() - 7)
  const weekEnd = now
  const twoWeeksAgo = new Date(now)
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)

  // 1. Get brand's products
  const brandProducts = await db
    .select({ id: products.id, name: products.name })
    .from(products)
    .where(eq(products.ownerId, brandOwnerId))

  if (brandProducts.length === 0) {
    return buildEmptyDigest(weekStart, weekEnd)
  }

  const alerts: DigestAlert[] = []
  const productSummaries: DigestProductSummary[] = []
  let totalThisWeek = 0
  let totalLastWeek = 0
  let sentimentSumThisWeek = 0
  let sentimentSumLastWeek = 0
  let sentimentCountThisWeek = 0
  let sentimentCountLastWeek = 0
  let newThemesCount = 0

  for (const product of brandProducts) {
    // This week's feedback
    const thisWeekFb = await db
      .select({
        sentiment: feedback.sentiment,
        feedbackText: feedback.feedbackText,
      })
      .from(feedback)
      .where(
        and(
          eq(feedback.productId, product.id),
          gte(feedback.createdAt, weekStart)
        )
      )

    // Last week's feedback
    const lastWeekFb = await db
      .select({
        sentiment: feedback.sentiment,
        feedbackText: feedback.feedbackText,
      })
      .from(feedback)
      .where(
        and(
          eq(feedback.productId, product.id),
          gte(feedback.createdAt, twoWeeksAgo),
          lt(feedback.createdAt, weekStart)
        )
      )

    const thisWeekCount = thisWeekFb.length
    const lastWeekCount = lastWeekFb.length
    totalThisWeek += thisWeekCount
    totalLastWeek += lastWeekCount

    // Sentiment calculations
    const sentimentThisWeek = calculateAvgSentiment(thisWeekFb)
    const sentimentLastWeek = calculateAvgSentiment(lastWeekFb)
    sentimentSumThisWeek += sentimentThisWeek * thisWeekCount
    sentimentSumLastWeek += sentimentLastWeek * lastWeekCount
    sentimentCountThisWeek += thisWeekCount
    sentimentCountLastWeek += lastWeekCount

    const volumeChange = lastWeekCount > 0
      ? ((thisWeekCount - lastWeekCount) / lastWeekCount) * 100
      : thisWeekCount > 0 ? 100 : 0

    const sentimentChange = sentimentThisWeek - sentimentLastWeek

    // Get recent themes
    const recentThemes = await db
      .select({ theme: extractedThemes.theme })
      .from(extractedThemes)
      .where(
        and(
          eq(extractedThemes.productId, product.id),
          gte(extractedThemes.extractedAt, weekStart)
        )
      )
      .orderBy(desc(extractedThemes.mentionCount))
      .limit(5)

    const topThemes = recentThemes.map(t => t.theme)
    newThemesCount += recentThemes.length

    // Generate alerts
    if (sentimentChange < -0.2 && thisWeekCount >= 3) {
      alerts.push({
        type: 'sentiment_drop',
        severity: sentimentChange < -0.4 ? 'high' : 'medium',
        title: `Sentiment drop for ${product.name}`,
        description: `Sentiment decreased by ${Math.abs(sentimentChange * 100).toFixed(0)}% this week compared to last week.`,
        productId: product.id,
        productName: product.name,
      })
    }

    if (volumeChange > 50 && thisWeekCount >= 5) {
      alerts.push({
        type: 'volume_spike',
        severity: volumeChange > 100 ? 'high' : 'medium',
        title: `Feedback volume spike for ${product.name}`,
        description: `${thisWeekCount} feedback items this week (${volumeChange.toFixed(0)}% increase).`,
        productId: product.id,
        productName: product.name,
      })
    }

    // Check for recurring negative themes
    const negativeThemes = await db
      .select({ theme: extractedThemes.theme, mentions: extractedThemes.mentionCount })
      .from(extractedThemes)
      .where(
        and(
          eq(extractedThemes.productId, product.id),
          eq(extractedThemes.sentiment, 'negative')
        )
      )
      .orderBy(desc(extractedThemes.mentionCount))
      .limit(3)

    for (const nt of negativeThemes) {
      if (nt.mentions >= 5) {
        alerts.push({
          type: 'recurring_issue',
          severity: nt.mentions >= 10 ? 'high' : 'medium',
          title: `Recurring issue: "${nt.theme}" (${product.name})`,
          description: `"${nt.theme}" has been mentioned ${nt.mentions} times with negative sentiment.`,
          productId: product.id,
          productName: product.name,
        })
      }
    }

    productSummaries.push({
      productId: product.id,
      productName: product.name,
      feedbackThisWeek: thisWeekCount,
      feedbackLastWeek: lastWeekCount,
      volumeChange,
      sentimentThisWeek,
      sentimentLastWeek,
      sentimentChange,
      topThemes,
    })
  }

  // Sort alerts by severity
  const severityOrder = { high: 0, medium: 1, low: 2 }
  alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])

  // Sort products by volume change (most activity first)
  productSummaries.sort((a, b) => b.feedbackThisWeek - a.feedbackThisWeek)

  const avgSentimentThisWeek = sentimentCountThisWeek > 0
    ? sentimentSumThisWeek / sentimentCountThisWeek
    : 0
  const avgSentimentLastWeek = sentimentCountLastWeek > 0
    ? sentimentSumLastWeek / sentimentCountLastWeek
    : 0

  return {
    weekStart: weekStart.toISOString(),
    weekEnd: weekEnd.toISOString(),
    alerts,
    productSummaries,
    overallStats: {
      totalFeedbackThisWeek: totalThisWeek,
      totalFeedbackLastWeek: totalLastWeek,
      volumeChange: totalLastWeek > 0
        ? ((totalThisWeek - totalLastWeek) / totalLastWeek) * 100
        : totalThisWeek > 0 ? 100 : 0,
      avgSentimentThisWeek,
      avgSentimentLastWeek,
      sentimentChange: avgSentimentThisWeek - avgSentimentLastWeek,
      newThemesCount,
    },
    generatedAt: now.toISOString(),
  }
}

// ── Helpers ───────────────────────────────────────────────────────

function calculateAvgSentiment(rows: Array<{ sentiment: string | null }>): number {
  if (rows.length === 0) return 0
  let sum = 0
  for (const row of rows) {
    if (row.sentiment === 'positive') sum += 1
    else if (row.sentiment === 'negative') sum -= 1
    // neutral = 0
  }
  return sum / rows.length
}

function buildEmptyDigest(weekStart: Date, weekEnd: Date): WeeklyDigestResult {
  return {
    weekStart: weekStart.toISOString(),
    weekEnd: weekEnd.toISOString(),
    alerts: [],
    productSummaries: [],
    overallStats: {
      totalFeedbackThisWeek: 0,
      totalFeedbackLastWeek: 0,
      volumeChange: 0,
      avgSentimentThisWeek: 0,
      avgSentimentLastWeek: 0,
      sentimentChange: 0,
      newThemesCount: 0,
    },
    generatedAt: new Date().toISOString(),
  }
}
