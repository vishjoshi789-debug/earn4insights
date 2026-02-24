import 'server-only'

import { db } from '@/db'
import { extractedThemes, feedback, surveyResponses } from '@/db/schema'
import { eq, desc, gte } from 'drizzle-orm'

// ── Types ─────────────────────────────────────────────────────────

export type PublicSummaryInsight = {
  label: string
  theme: string
  mentionCount: number
  sentiment: string
  example: string | null
}

export type PublicProductSummary = {
  productId: string
  topPraise: PublicSummaryInsight | null
  topConcern: PublicSummaryInsight | null
  emergingIssue: PublicSummaryInsight | null
  overallSentiment: {
    positive: number
    negative: number
    neutral: number
    score: number // -1 to 1
  }
  recentHighlights: string[]
  totalFeedbackCount: number
  lastUpdated: string
}

// ── Main function ─────────────────────────────────────────────────

/**
 * Generate a public-safe AI summary for a product.
 * Uses extracted themes + recent feedback to produce
 * Top Praise, Top Concern, and Emerging Issue.
 */
export async function generatePublicSummary(
  productId: string
): Promise<PublicProductSummary> {
  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  // 1. Get extracted themes for this product
  const themes = await db
    .select()
    .from(extractedThemes)
    .where(eq(extractedThemes.productId, productId))
    .orderBy(desc(extractedThemes.mentionCount))
    .limit(20)

  // 2. Get recent feedback for sentiment counts
  const recentFeedback = await db
    .select({
      sentiment: feedback.sentiment,
      feedbackText: feedback.feedbackText,
      createdAt: feedback.createdAt,
    })
    .from(feedback)
    .where(eq(feedback.productId, productId))
    .orderBy(desc(feedback.createdAt))
    .limit(200)

  // 3. Count all feedback + surveys
  const allFeedback = await db
    .select({ id: feedback.id })
    .from(feedback)
    .where(eq(feedback.productId, productId))

  const allSurveys = await db
    .select({ id: surveyResponses.id })
    .from(surveyResponses)
    .where(eq(surveyResponses.productId, productId))

  const totalFeedbackCount = allFeedback.length + allSurveys.length

  // 4. Overall sentiment from feedback
  const positive = recentFeedback.filter(f => f.sentiment === 'positive').length
  const negative = recentFeedback.filter(f => f.sentiment === 'negative').length
  const neutral = recentFeedback.filter(f => f.sentiment === 'neutral' || !f.sentiment).length
  const total = positive + negative + neutral
  const sentimentScore = total > 0 ? (positive - negative) / total : 0

  // 5. Identify top praise (highest mention positive theme)
  const positiveThemes = themes.filter(t => t.sentiment === 'positive')
  const topPraise = positiveThemes.length > 0
    ? buildInsight('🌟 Top Praise', positiveThemes[0])
    : null

  // 6. Identify top concern (highest mention negative theme)
  const negativeThemes = themes.filter(t => t.sentiment === 'negative')
  const topConcern = negativeThemes.length > 0
    ? buildInsight('⚠️ Top Concern', negativeThemes[0])
    : null

  // 7. Emerging issue: look for themes extracted recently with growing mentions
  // or themes with 'mixed' sentiment (indicates unresolved)
  const mixedThemes = themes.filter(t => t.sentiment === 'mixed')
  const recentThemes = themes.filter(t => {
    if (!t.extractedAt) return false
    return new Date(t.extractedAt) >= sevenDaysAgo
  })

  const emergingCandidate = recentThemes.find(t => t.sentiment === 'negative' || t.sentiment === 'mixed')
    || mixedThemes[0]
    || null

  const emergingIssue = emergingCandidate
    ? buildInsight('🔔 Emerging Issue', emergingCandidate)
    : null

  // 8. Recent highlights — short positive feedback excerpts
  const recentHighlights = recentFeedback
    .filter(f => f.sentiment === 'positive' && f.feedbackText)
    .slice(0, 3)
    .map(f => f.feedbackText!.slice(0, 100))

  return {
    productId,
    topPraise,
    topConcern,
    emergingIssue,
    overallSentiment: { positive, negative, neutral, score: sentimentScore },
    recentHighlights,
    totalFeedbackCount,
    lastUpdated: now.toISOString(),
  }
}

// ── Helpers ───────────────────────────────────────────────────────

function buildInsight(
  label: string,
  theme: {
    theme: string
    mentionCount: number
    sentiment: string | null
    examples: unknown
  }
): PublicSummaryInsight {
  const examples = theme.examples as string[] | null
  return {
    label,
    theme: theme.theme,
    mentionCount: theme.mentionCount,
    sentiment: theme.sentiment || 'neutral',
    example: examples && examples.length > 0 ? examples[0].slice(0, 120) : null,
  }
}
