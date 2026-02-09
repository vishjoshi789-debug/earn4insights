import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export type ExtractedTheme = {
  theme: string
  count: number
  sentiment: 'positive' | 'negative' | 'neutral'
  examples: string[]
}

export type ThemeExtractionResult = {
  themes: ExtractedTheme[]
  totalFeedbackAnalyzed: number
  extractedAt: Date
}

/**
 * Extract recurring themes from a batch of normalized feedback text
 * using OpenAI GPT for intelligent pattern recognition.
 */
export async function extractThemesFromFeedback(
  feedbackTexts: string[],
  options?: { maxThemes?: number; productContext?: string }
): Promise<ThemeExtractionResult> {
  const maxThemes = options?.maxThemes || 10
  const productContext = options?.productContext || 'this product'

  if (feedbackTexts.length === 0) {
    return { themes: [], totalFeedbackAnalyzed: 0, extractedAt: new Date() }
  }

  // Limit input size for cost control
  const sampleSize = Math.min(feedbackTexts.length, 200)
  const sampleTexts = feedbackTexts.slice(0, sampleSize)

  const prompt = `You are analyzing customer feedback for ${productContext}. Extract the top ${maxThemes} recurring themes or topics.

For each theme provide:
1. A concise theme name (2-4 words)
2. Estimated count of feedback items mentioning this theme
3. Overall sentiment (positive, negative, or neutral)
4. 2-3 example quotes

Feedback texts (${sampleTexts.length} samples):
${sampleTexts.map((text, i) => `${i + 1}. "${text}"`).join('\n')}

Return ONLY valid JSON:
{
  "themes": [
    { "theme": "Battery Life", "count": 15, "sentiment": "negative", "examples": ["Battery drains too fast", "Needs charging twice a day"] }
  ]
}`

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'You are a customer feedback analyst. Extract themes accurately and return only valid JSON.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 1500,
    })

    const content = response.choices[0]?.message?.content?.trim()
    if (!content) throw new Error('Empty response from OpenAI')

    const parsed = JSON.parse(content)
    const themes: ExtractedTheme[] = (parsed.themes || [])
      .slice(0, maxThemes)
      .map((t: any) => ({
        theme: String(t.theme || 'Unknown'),
        count: Number(t.count || 0),
        sentiment: (['positive', 'negative', 'neutral'].includes(t.sentiment)
          ? t.sentiment
          : 'neutral') as 'positive' | 'negative' | 'neutral',
        examples: Array.isArray(t.examples) ? t.examples.slice(0, 3).map(String) : [],
      }))

    return { themes, totalFeedbackAnalyzed: sampleTexts.length, extractedAt: new Date() }
  } catch (error) {
    console.error('Theme extraction error:', error)
    return fallbackThemeExtraction(feedbackTexts, maxThemes)
  }
}

/**
 * Fallback: simple keyword-based theme extraction when OpenAI fails
 */
function fallbackThemeExtraction(
  feedbackTexts: string[],
  maxThemes: number
): ThemeExtractionResult {
  const keywords = [
    'price', 'quality', 'delivery', 'customer service', 'support',
    'battery', 'performance', 'design', 'ease of use', 'features',
    'reliability', 'packaging', 'value', 'speed', 'durability',
  ]

  const themeMap = new Map<string, { count: number; examples: string[] }>()
  feedbackTexts.forEach((text) => {
    const lower = text.toLowerCase()
    keywords.forEach((kw) => {
      if (lower.includes(kw)) {
        const existing = themeMap.get(kw) || { count: 0, examples: [] }
        existing.count++
        if (existing.examples.length < 3) existing.examples.push(text.slice(0, 100))
        themeMap.set(kw, existing)
      }
    })
  })

  const themes: ExtractedTheme[] = Array.from(themeMap.entries())
    .map(([theme, data]) => ({ theme, count: data.count, sentiment: 'neutral' as const, examples: data.examples }))
    .sort((a, b) => b.count - a.count)
    .slice(0, maxThemes)

  return { themes, totalFeedbackAnalyzed: feedbackTexts.length, extractedAt: new Date() }
}

/**
 * Extract themes for a specific product from all feedback sources
 */
export async function extractThemesForProduct(productId: string) {
  const { db } = await import('@/db')
  const { feedback, surveyResponses } = await import('@/db/schema')
  const { eq } = await import('drizzle-orm')

  const [directFeedback, surveyFeedback] = await Promise.all([
    db.select({ normalizedText: feedback.normalizedText }).from(feedback).where(eq(feedback.productId, productId)),
    db.select({ normalizedText: surveyResponses.normalizedText }).from(surveyResponses).where(eq(surveyResponses.productId, productId)),
  ])

  const allTexts = [
    ...directFeedback.filter((f) => f.normalizedText).map((f) => f.normalizedText!),
    ...surveyFeedback.filter((s) => s.normalizedText).map((s) => s.normalizedText!),
  ]

  return extractThemesFromFeedback(allTexts, { productContext: `product ${productId}` })
}
