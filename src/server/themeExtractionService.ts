import 'server-only'

import OpenAI from 'openai'
import { db } from '@/db'
import { feedback, surveyResponses } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { saveExtractedThemes } from '@/db/repositories/themeRepository'

// ── Configuration ─────────────────────────────────────────────────

const MAX_FEEDBACK_SAMPLE = 200
const MAX_TOKENS = 1500
const OPENAI_MODEL = process.env.OPENAI_THEME_MODEL || 'gpt-4o-mini'
const OPENAI_TEMPERATURE = 0.3

// ── Types ─────────────────────────────────────────────────────────

export type ExtractedThemeResult = {
  theme: string
  mentionCount: number
  sentiment: 'positive' | 'negative' | 'neutral' | 'mixed'
  examples: string[]
}

export type ExtractionResult = {
  productId: string
  themes: ExtractedThemeResult[]
  totalFeedbackAnalyzed: number
  method: 'openai' | 'keyword'
}

// ── Main extraction function ──────────────────────────────────────

/**
 * Extract themes for a single product.
 * Uses OpenAI if API key is available, otherwise falls back to keyword extraction.
 */
export async function extractThemesForProduct(productId: string): Promise<ExtractionResult> {
  // 1. Gather feedback text
  const texts = await gatherFeedbackTexts(productId)

  if (texts.length === 0) {
    return {
      productId,
      themes: [],
      totalFeedbackAnalyzed: 0,
      method: 'keyword',
    }
  }

  // 2. Sample if too many
  const sampled = texts.length > MAX_FEEDBACK_SAMPLE
    ? sampleArray(texts, MAX_FEEDBACK_SAMPLE)
    : texts

  // 3. Try OpenAI, fall back to keyword
  let themes: ExtractedThemeResult[]
  let method: 'openai' | 'keyword'

  try {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) throw new Error('No OPENAI_API_KEY')

    themes = await extractWithOpenAI(sampled, apiKey)
    method = 'openai'
  } catch (err) {
    console.warn('[ThemeExtraction] OpenAI unavailable, using keyword fallback:', (err as Error).message)
    themes = extractWithKeywords(sampled)
    method = 'keyword'
  }

  // 4. Save to DB
  await saveExtractedThemes(
    productId,
    themes.map((t) => ({
      theme: t.theme,
      mentionCount: t.mentionCount,
      sentiment: t.sentiment,
      examples: t.examples,
      totalFeedbackAnalyzed: sampled.length,
      extractionMethod: method,
    }))
  )

  return {
    productId,
    themes,
    totalFeedbackAnalyzed: sampled.length,
    method,
  }
}

/**
 * Extract themes for all products that have feedback.
 * Used by the cron job.
 */
export async function extractThemesForAllProducts(): Promise<{
  processed: number
  results: ExtractionResult[]
  errors: { productId: string; error: string }[]
}> {
  // Get distinct product IDs from feedback
  const productRows = await db
    .selectDistinct({ productId: feedback.productId })
    .from(feedback)

  const results: ExtractionResult[] = []
  const errors: { productId: string; error: string }[] = []

  for (const row of productRows) {
    try {
      const result = await extractThemesForProduct(row.productId)
      results.push(result)

      // Small delay between products to avoid rate limits
      await delay(2000)
    } catch (err) {
      console.error(`[ThemeExtraction] Error for product ${row.productId}:`, err)
      errors.push({
        productId: row.productId,
        error: err instanceof Error ? err.message : 'Unknown error',
      })
    }
  }

  return {
    processed: results.length,
    results,
    errors,
  }
}

// ── Data gathering ────────────────────────────────────────────────

async function gatherFeedbackTexts(productId: string): Promise<string[]> {
  const texts: string[] = []

  // Gather from feedback table
  try {
    const feedbackRows = await db
      .select({
        feedbackText: feedback.feedbackText,
        normalizedText: feedback.normalizedText,
      })
      .from(feedback)
      .where(eq(feedback.productId, productId))

    for (const row of feedbackRows) {
      const text = row.normalizedText || row.feedbackText
      if (text && text.trim().length > 5) {
        texts.push(text.trim())
      }
    }
  } catch (err) {
    console.warn('[ThemeExtraction] Could not read feedback table:', (err as Error).message)
  }

  // Gather from survey responses (free-text answers)
  try {
    const surveyRows = await db
      .select({
        answers: surveyResponses.answers,
        normalizedText: surveyResponses.normalizedText,
      })
      .from(surveyResponses)
      .where(eq(surveyResponses.productId, productId))

    for (const row of surveyRows) {
      // Use normalized text if available
      if (row.normalizedText && row.normalizedText.trim().length > 5) {
        texts.push(row.normalizedText.trim())
        continue
      }

      // Extract free-text from survey answers JSON
      if (row.answers && typeof row.answers === 'object') {
        const answers = row.answers as Record<string, any>
        for (const value of Object.values(answers)) {
          if (typeof value === 'string' && value.trim().length > 5) {
            texts.push(value.trim())
          }
        }
      }
    }
  } catch (err) {
    console.warn('[ThemeExtraction] Could not read survey_responses table:', (err as Error).message)
  }

  return texts
}

// ── OpenAI extraction ─────────────────────────────────────────────

async function extractWithOpenAI(
  texts: string[],
  apiKey: string
): Promise<ExtractedThemeResult[]> {
  const openai = new OpenAI({ apiKey })

  const feedbackBlock = texts
    .map((t, i) => `${i + 1}. ${t}`)
    .join('\n')

  const prompt = `You are a product feedback analyst. Analyze the following user feedback and extract the top recurring themes.

For each theme, provide:
- theme: A short label (2-5 words)
- mentionCount: How many feedback items mention this theme
- sentiment: Overall sentiment for this theme ("positive", "negative", "neutral", or "mixed")
- examples: 2-3 direct quotes that best represent this theme (keep them short, max 100 chars each)

Return ONLY valid JSON in this exact format:
{
  "themes": [
    {
      "theme": "string",
      "mentionCount": number,
      "sentiment": "positive" | "negative" | "neutral" | "mixed",
      "examples": ["string", "string"]
    }
  ]
}

Return the top 10 themes maximum, ordered by mention count descending.

USER FEEDBACK (${texts.length} items):
${feedbackBlock}`

  const completion = await openai.chat.completions.create({
    model: OPENAI_MODEL,
    temperature: OPENAI_TEMPERATURE,
    max_tokens: MAX_TOKENS,
    messages: [
      { role: 'system', content: 'You extract product feedback themes. Return only valid JSON, no markdown.' },
      { role: 'user', content: prompt },
    ],
  })

  const content = completion.choices[0]?.message?.content?.trim() || ''

  // Parse the JSON response
  try {
    // Strip markdown code fences if present
    const cleaned = content.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
    const parsed = JSON.parse(cleaned) as { themes: ExtractedThemeResult[] }

    if (!Array.isArray(parsed.themes)) {
      throw new Error('Response missing themes array')
    }

    return parsed.themes.slice(0, 10).map((t) => ({
      theme: String(t.theme || 'Unknown'),
      mentionCount: Number(t.mentionCount) || 1,
      sentiment: validateSentiment(t.sentiment),
      examples: Array.isArray(t.examples)
        ? t.examples.slice(0, 3).map((e) => String(e).slice(0, 150))
        : [],
    }))
  } catch (parseErr) {
    console.error('[ThemeExtraction] Failed to parse OpenAI response:', content)
    throw new Error('Failed to parse OpenAI theme extraction response')
  }
}

// ── Keyword fallback ──────────────────────────────────────────────

const KEYWORD_THEMES: Record<string, string[]> = {
  'User Experience': ['ui', 'ux', 'design', 'interface', 'layout', 'navigation', 'intuitive', 'confusing', 'user-friendly', 'clunky'],
  'Performance': ['slow', 'fast', 'speed', 'performance', 'loading', 'lag', 'responsive', 'crash', 'freeze', 'quick'],
  'Price & Value': ['price', 'expensive', 'cheap', 'cost', 'value', 'worth', 'money', 'affordable', 'overpriced', 'budget'],
  'Customer Support': ['support', 'help', 'service', 'response', 'team', 'agent', 'ticket', 'resolved', 'complaint', 'assistance'],
  'Features': ['feature', 'missing', 'add', 'need', 'want', 'functionality', 'capability', 'option', 'setting', 'tool'],
  'Quality': ['quality', 'reliable', 'durable', 'broken', 'defect', 'excellent', 'poor', 'great', 'terrible', 'solid'],
  'Ease of Use': ['easy', 'simple', 'difficult', 'complicated', 'straightforward', 'hard', 'learn', 'beginner', 'setup', 'install'],
  'Documentation': ['docs', 'documentation', 'tutorial', 'guide', 'instructions', 'manual', 'example', 'readme', 'help'],
  'Integration': ['integrate', 'integration', 'api', 'connect', 'plugin', 'extension', 'compatibility', 'work with'],
  'Security': ['security', 'secure', 'privacy', 'data', 'safe', 'protection', 'encrypt', 'vulnerability', 'breach', 'trust'],
}

const POSITIVE_WORDS = new Set(['great', 'good', 'excellent', 'love', 'amazing', 'fantastic', 'wonderful', 'best', 'perfect', 'awesome', 'impressed', 'happy', 'satisfied', 'recommend', 'easy', 'fast', 'reliable', 'intuitive', 'solid'])
const NEGATIVE_WORDS = new Set(['bad', 'terrible', 'worst', 'hate', 'horrible', 'awful', 'poor', 'broken', 'slow', 'crash', 'bug', 'confusing', 'expensive', 'disappointed', 'frustrating', 'difficult', 'complicated', 'missing', 'overpriced', 'clunky'])

function extractWithKeywords(texts: string[]): ExtractedThemeResult[] {
  const themeMatches: Record<string, { count: number; examples: string[]; positive: number; negative: number }> = {}

  for (const text of texts) {
    const lower = text.toLowerCase()
    const words = lower.split(/\W+/)

    for (const [theme, keywords] of Object.entries(KEYWORD_THEMES)) {
      const matches = keywords.some((kw) => lower.includes(kw))
      if (matches) {
        if (!themeMatches[theme]) {
          themeMatches[theme] = { count: 0, examples: [], positive: 0, negative: 0 }
        }
        themeMatches[theme].count++
        if (themeMatches[theme].examples.length < 3) {
          themeMatches[theme].examples.push(text.slice(0, 150))
        }

        // Sentiment counting
        const hasPositive = words.some((w) => POSITIVE_WORDS.has(w))
        const hasNegative = words.some((w) => NEGATIVE_WORDS.has(w))
        if (hasPositive) themeMatches[theme].positive++
        if (hasNegative) themeMatches[theme].negative++
      }
    }
  }

  return Object.entries(themeMatches)
    .filter(([, data]) => data.count >= 1)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10)
    .map(([theme, data]) => ({
      theme,
      mentionCount: data.count,
      sentiment: deriveSentiment(data.positive, data.negative),
      examples: data.examples,
    }))
}

// ── Helpers ───────────────────────────────────────────────────────

function validateSentiment(s: any): 'positive' | 'negative' | 'neutral' | 'mixed' {
  if (['positive', 'negative', 'neutral', 'mixed'].includes(s)) return s
  return 'mixed'
}

function deriveSentiment(positive: number, negative: number): 'positive' | 'negative' | 'neutral' | 'mixed' {
  if (positive > 0 && negative > 0) return 'mixed'
  if (positive > 0) return 'positive'
  if (negative > 0) return 'negative'
  return 'neutral'
}

function sampleArray<T>(arr: T[], maxSize: number): T[] {
  if (arr.length <= maxSize) return arr
  const shuffled = [...arr].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, maxSize)
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
