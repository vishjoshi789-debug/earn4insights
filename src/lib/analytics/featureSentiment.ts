import 'server-only'

import { db } from '@/db'
import { feedback, surveyResponses } from '@/db/schema'
import { eq, gte, desc } from 'drizzle-orm'
import { analyzeSentiment } from '@/server/sentimentService'

// ── Types ─────────────────────────────────────────────────────────

export type FeatureSentimentEntry = {
  feature: string
  mentionCount: number
  sentiment: {
    positive: number
    negative: number
    neutral: number
    score: number // -1 to 1
  }
  trend: {
    current7d: number
    previous7d: number
    direction: 'up' | 'down' | 'stable'
    changePercent: number
  }
  topPraises: string[]
  topComplaints: string[]
}

export type FeatureSentimentResult = {
  productId: string
  features: FeatureSentimentEntry[]
  totalTextsAnalyzed: number
  computedAt: string
}

// ── Feature keyword dictionaries ──────────────────────────────────
// Organized by product category-agnostic features, plus category-specific ones.

const FEATURE_KEYWORDS: Record<string, string[]> = {
  // Universal features
  'Price & Value': ['price', 'pricing', 'cost', 'expensive', 'cheap', 'affordable', 'value', 'money', 'worth', 'overpriced', 'budget', 'free', 'subscription', 'plan'],
  'User Experience': ['ui', 'ux', 'design', 'interface', 'layout', 'navigation', 'intuitive', 'confusing', 'user-friendly', 'clean', 'ugly', 'modern', 'outdated'],
  'Performance': ['slow', 'fast', 'speed', 'performance', 'loading', 'lag', 'responsive', 'crash', 'freeze', 'smooth', 'sluggish', 'buffer'],
  'Customer Support': ['support', 'help', 'service', 'response', 'agent', 'ticket', 'resolved', 'complaint', 'wait', 'rude', 'helpful', 'friendly'],
  'Reliability': ['reliable', 'stable', 'downtime', 'bug', 'broken', 'error', 'crash', 'glitch', 'works', 'consistent', 'uptime'],
  'Ease of Use': ['easy', 'simple', 'difficult', 'complicated', 'straightforward', 'hard', 'learn', 'beginner', 'setup', 'onboarding'],
  'Quality': ['quality', 'durable', 'excellent', 'poor', 'premium', 'cheap', 'solid', 'flimsy', 'built', 'material'],

  // Consumer Electronics specific
  'Battery': ['battery', 'charge', 'charging', 'battery life', 'drain', 'power', 'mah', 'fast charge', 'wireless charge'],
  'Camera': ['camera', 'photo', 'picture', 'lens', 'megapixel', 'zoom', 'portrait', 'night mode', 'selfie', 'video quality'],
  'Display': ['screen', 'display', 'resolution', 'brightness', 'oled', 'lcd', 'refresh rate', 'notch', 'bezel'],
  'Sound & Audio': ['sound', 'audio', 'speaker', 'bass', 'volume', 'noise canceling', 'headphone', 'microphone', 'bluetooth'],
  'Storage': ['storage', 'memory', 'ram', 'space', 'capacity', 'expandable', 'gb', 'tb'],

  // SaaS specific
  'Features & Functionality': ['feature', 'missing', 'add', 'need', 'want', 'functionality', 'capability', 'option', 'setting', 'tool', 'integration'],
  'Security': ['security', 'secure', 'privacy', 'data', 'safe', 'protection', 'encrypt', 'breach', 'trust', '2fa', 'password'],
  'Documentation': ['docs', 'documentation', 'tutorial', 'guide', 'instructions', 'manual', 'example', 'readme', 'api'],

  // Food & Beverage specific
  'Taste & Flavor': ['taste', 'flavor', 'delicious', 'bland', 'spicy', 'sweet', 'sour', 'fresh', 'stale', 'yummy'],
  'Delivery': ['delivery', 'shipping', 'arrived', 'late', 'fast delivery', 'packaging', 'damaged', 'tracking', 'courier'],
  'Portion Size': ['portion', 'size', 'quantity', 'small', 'large', 'enough', 'generous', 'tiny'],
}

const POSITIVE_INDICATORS = new Set([
  'love', 'great', 'excellent', 'amazing', 'awesome', 'fantastic', 'wonderful',
  'good', 'best', 'perfect', 'happy', 'satisfied', 'impressed', 'recommend',
  'easy', 'fast', 'reliable', 'intuitive', 'solid', 'beautiful', 'smooth',
])

const NEGATIVE_INDICATORS = new Set([
  'hate', 'bad', 'terrible', 'awful', 'horrible', 'poor', 'worst',
  'disappointing', 'frustrated', 'angry', 'slow', 'broken', 'useless',
  'waste', 'problem', 'issue', 'confusing', 'difficult', 'overpriced', 'ugly',
])

// ── Main function ─────────────────────────────────────────────────

/**
 * Extract feature-level sentiment for a product.
 * Rule-based MVP: matches keywords from feedback text,
 * computes per-feature sentiment + 7-day trend.
 */
export async function analyzeFeatureSentiment(
  productId: string
): Promise<FeatureSentimentResult> {
  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)

  // Gather all text data with timestamps
  const texts = await gatherTextsWithTimestamps(productId)

  if (texts.length === 0) {
    return { productId, features: [], totalTextsAnalyzed: 0, computedAt: now.toISOString() }
  }

  // Build feature buckets
  const featureMap = new Map<string, {
    mentions: Array<{ text: string; date: Date; sentimentWord: 'positive' | 'negative' | 'neutral' }>
  }>()

  for (const { text, date } of texts) {
    const lower = text.toLowerCase()
    const words = lower.split(/\W+/)

    // Determine text-level sentiment from indicator words
    const hasPositive = words.some(w => POSITIVE_INDICATORS.has(w))
    const hasNegative = words.some(w => NEGATIVE_INDICATORS.has(w))
    const textSentiment: 'positive' | 'negative' | 'neutral' =
      hasPositive && !hasNegative ? 'positive' :
      hasNegative && !hasPositive ? 'negative' :
      hasPositive && hasNegative ? 'neutral' : 'neutral'

    for (const [feature, keywords] of Object.entries(FEATURE_KEYWORDS)) {
      const matched = keywords.some(kw => lower.includes(kw))
      if (matched) {
        if (!featureMap.has(feature)) {
          featureMap.set(feature, { mentions: [] })
        }
        featureMap.get(feature)!.mentions.push({ text, date, sentimentWord: textSentiment })
      }
    }
  }

  // Build result entries (only features with mentions)
  const features: FeatureSentimentEntry[] = []

  for (const [feature, data] of featureMap.entries()) {
    if (data.mentions.length === 0) continue

    const positive = data.mentions.filter(m => m.sentimentWord === 'positive').length
    const negative = data.mentions.filter(m => m.sentimentWord === 'negative').length
    const neutral = data.mentions.filter(m => m.sentimentWord === 'neutral').length
    const total = data.mentions.length
    const sentimentScore = total > 0 ? (positive - negative) / total : 0

    // 7-day trend
    const current7d = data.mentions.filter(m => m.date >= sevenDaysAgo).length
    const previous7d = data.mentions.filter(m => m.date >= fourteenDaysAgo && m.date < sevenDaysAgo).length
    const changePercent = previous7d > 0
      ? ((current7d - previous7d) / previous7d) * 100
      : current7d > 0 ? 100 : 0
    const direction: 'up' | 'down' | 'stable' =
      changePercent > 10 ? 'up' :
      changePercent < -10 ? 'down' : 'stable'

    // Top praises and complaints (unique, short excerpts)
    const topPraises = data.mentions
      .filter(m => m.sentimentWord === 'positive')
      .slice(0, 3)
      .map(m => m.text.slice(0, 120))

    const topComplaints = data.mentions
      .filter(m => m.sentimentWord === 'negative')
      .slice(0, 3)
      .map(m => m.text.slice(0, 120))

    features.push({
      feature,
      mentionCount: total,
      sentiment: { positive, negative, neutral, score: sentimentScore },
      trend: { current7d, previous7d, direction, changePercent },
      topPraises,
      topComplaints,
    })
  }

  // Sort by mention count descending
  features.sort((a, b) => b.mentionCount - a.mentionCount)

  return {
    productId,
    features,
    totalTextsAnalyzed: texts.length,
    computedAt: now.toISOString(),
  }
}

// ── Data gathering ────────────────────────────────────────────────

async function gatherTextsWithTimestamps(
  productId: string
): Promise<Array<{ text: string; date: Date }>> {
  const results: Array<{ text: string; date: Date }> = []

  // From feedback table
  try {
    const rows = await db
      .select({
        feedbackText: feedback.feedbackText,
        normalizedText: feedback.normalizedText,
        createdAt: feedback.createdAt,
      })
      .from(feedback)
      .where(eq(feedback.productId, productId))
      .orderBy(desc(feedback.createdAt))
      .limit(500)

    for (const row of rows) {
      const text = row.normalizedText || row.feedbackText
      if (text && text.trim().length > 5) {
        results.push({ text: text.trim(), date: row.createdAt })
      }
    }
  } catch (err) {
    console.warn('[FeatureSentiment] Could not read feedback:', err)
  }

  // From survey responses
  try {
    const rows = await db
      .select({
        answers: surveyResponses.answers,
        normalizedText: surveyResponses.normalizedText,
        submittedAt: surveyResponses.submittedAt,
      })
      .from(surveyResponses)
      .where(eq(surveyResponses.productId, productId))
      .orderBy(desc(surveyResponses.submittedAt))
      .limit(500)

    for (const row of rows) {
      const date = row.submittedAt ? new Date(row.submittedAt) : new Date()
      if (row.normalizedText && row.normalizedText.trim().length > 5) {
        results.push({ text: row.normalizedText.trim(), date })
        continue
      }
      if (row.answers && typeof row.answers === 'object') {
        for (const value of Object.values(row.answers as Record<string, any>)) {
          if (typeof value === 'string' && value.trim().length > 5) {
            results.push({ text: value.trim(), date })
          }
        }
      }
    }
  } catch (err) {
    console.warn('[FeatureSentiment] Could not read survey responses:', err)
  }

  return results
}
