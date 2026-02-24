import 'server-only'

import { db } from '@/db'
import { products, feedback, surveyResponses, extractedThemes } from '@/db/schema'
import { eq, desc, sql, and, gte } from 'drizzle-orm'
import { calculateProductHealthScore, type ProductHealthResult } from './productHealthScore'
import type { ProductCategory } from '@/lib/categories'

// ── Types ─────────────────────────────────────────────────────────

export type CategoryProductEntry = {
  productId: string
  productName: string
  healthScore: number
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  trend: 'improving' | 'stable' | 'declining'
  feedbackCount: number
  avgSentiment: number
  topTheme: string | null
}

export type CategoryInsight = {
  avgHealthScore: number
  topPerformer: { name: string; score: number } | null
  mostDiscussedTheme: string | null
  sentimentDistribution: { positive: number; negative: number; neutral: number }
  totalFeedback: number
  totalProducts: number
  trendingUp: number
  trendingDown: number
}

export type CategoryIntelligenceResult = {
  category: string
  categoryName: string
  products: CategoryProductEntry[]
  insights: CategoryInsight
  computedAt: string
}

// ── Main function ─────────────────────────────────────────────────

/**
 * Generate intelligence report for a product category.
 * Pulls all products in the category, computes health scores,
 * aggregates themes, and produces insights.
 */
export async function getCategoryIntelligence(
  category: ProductCategory
): Promise<CategoryIntelligenceResult> {
  const now = new Date()

  // 1. Get all products in this category
  const categoryProducts = await db
    .select({ id: products.id, name: products.name })
    .from(products)
    .where(
      sql`${products.profile}->>'productCategory' = ${category}`
    )
    .limit(100)

  if (categoryProducts.length === 0) {
    return buildEmptyResult(category)
  }

  // 2. Compute health scores for all products
  const entries: CategoryProductEntry[] = []
  let totalFeedbackAll = 0
  let positiveAll = 0
  let negativeAll = 0
  let neutralAll = 0
  let trendingUp = 0
  let trendingDown = 0

  for (const product of categoryProducts) {
    try {
      const health = await calculateProductHealthScore(product.id)

      // Get feedback count and sentiment breakdown
      const fb = await db
        .select({ sentiment: feedback.sentiment })
        .from(feedback)
        .where(eq(feedback.productId, product.id))

      const positive = fb.filter(f => f.sentiment === 'positive').length
      const negative = fb.filter(f => f.sentiment === 'negative').length
      const neutral = fb.filter(f => f.sentiment === 'neutral' || !f.sentiment).length
      const fbTotal = fb.length

      positiveAll += positive
      negativeAll += negative
      neutralAll += neutral
      totalFeedbackAll += fbTotal

      if (health.trend === 'improving') trendingUp++
      if (health.trend === 'declining') trendingDown++

      // Top theme for this product
      const topTheme = await db
        .select({ theme: extractedThemes.theme })
        .from(extractedThemes)
        .where(eq(extractedThemes.productId, product.id))
        .orderBy(desc(extractedThemes.mentionCount))
        .limit(1)

      entries.push({
        productId: product.id,
        productName: product.name,
        healthScore: health.healthScore,
        grade: health.grade,
        trend: health.trend,
        feedbackCount: health.dataPoints,
        avgSentiment: fbTotal > 0 ? (positive - negative) / fbTotal : 0,
        topTheme: topTheme[0]?.theme || null,
      })
    } catch (err) {
      console.error(`[CategoryIntelligence] Error for ${product.id}:`, err)
    }
  }

  // Sort by health score descending
  entries.sort((a, b) => b.healthScore - a.healthScore)

  // 3. Category-wide top theme
  const allThemes = await db
    .select({
      theme: extractedThemes.theme,
      totalMentions: sql<number>`SUM(${extractedThemes.mentionCount})`,
    })
    .from(extractedThemes)
    .where(
      sql`${extractedThemes.productId} IN (${sql.join(
        categoryProducts.map(p => sql`${p.id}`),
        sql`, `
      )})`
    )
    .groupBy(extractedThemes.theme)
    .orderBy(desc(sql`SUM(${extractedThemes.mentionCount})`))
    .limit(1)

  const avgHealthScore = entries.length > 0
    ? Math.round(entries.reduce((s, e) => s + e.healthScore, 0) / entries.length)
    : 0

  const topPerformer = entries.length > 0
    ? { name: entries[0].productName, score: entries[0].healthScore }
    : null

  const insights: CategoryInsight = {
    avgHealthScore,
    topPerformer,
    mostDiscussedTheme: allThemes[0]?.theme || null,
    sentimentDistribution: { positive: positiveAll, negative: negativeAll, neutral: neutralAll },
    totalFeedback: totalFeedbackAll,
    totalProducts: categoryProducts.length,
    trendingUp,
    trendingDown,
  }

  // Map category key to readable name
  const { getCategoryName } = await import('@/lib/categories')

  return {
    category,
    categoryName: getCategoryName(category),
    products: entries,
    insights,
    computedAt: now.toISOString(),
  }
}

// ── Helpers ───────────────────────────────────────────────────────

function buildEmptyResult(category: string): CategoryIntelligenceResult {
  return {
    category,
    categoryName: category,
    products: [],
    insights: {
      avgHealthScore: 0,
      topPerformer: null,
      mostDiscussedTheme: null,
      sentimentDistribution: { positive: 0, negative: 0, neutral: 0 },
      totalFeedback: 0,
      totalProducts: 0,
      trendingUp: 0,
      trendingDown: 0,
    },
    computedAt: new Date().toISOString(),
  }
}
