import { db } from '@/db'
import { extractedThemes } from '@/db/schema'
import { eq, desc, and, sql } from 'drizzle-orm'

export type ThemeRecord = {
  id: string
  productId: string
  theme: string
  count: number
  sentiment: string
  examples: string[]
  totalFeedbackAnalyzed: number
  extractedAt: Date
  extractionMethod: string
  createdAt: Date
}

/** Save extracted themes to database */
export async function saveExtractedThemes(
  productId: string,
  themes: Array<{ theme: string; count: number; sentiment: string; examples: string[] }>,
  metadata: { totalFeedbackAnalyzed: number; extractedAt: Date; extractionMethod?: string }
) {
  const records = themes.map((t) => ({
    productId,
    theme: t.theme,
    count: t.count,
    sentiment: t.sentiment,
    examples: t.examples,
    totalFeedbackAnalyzed: metadata.totalFeedbackAnalyzed,
    extractedAt: metadata.extractedAt,
    extractionMethod: metadata.extractionMethod || 'openai',
  }))
  return await db.insert(extractedThemes).values(records).returning()
}

/** Get latest themes for a product */
export async function getLatestThemesForProduct(productId: string, limit = 20) {
  const [latest] = await db
    .select({ latestExtraction: sql<Date>`MAX(${extractedThemes.extractedAt})` })
    .from(extractedThemes)
    .where(eq(extractedThemes.productId, productId))

  if (!latest?.latestExtraction) return []

  return await db
    .select()
    .from(extractedThemes)
    .where(and(eq(extractedThemes.productId, productId), eq(extractedThemes.extractedAt, latest.latestExtraction)))
    .orderBy(desc(extractedThemes.count))
    .limit(limit) as ThemeRecord[]
}

/** Delete old themes (cleanup) */
export async function cleanupOldThemes(daysToKeep = 90) {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - daysToKeep)
  const deleted = await db.delete(extractedThemes).where(sql`${extractedThemes.extractedAt} < ${cutoff}`).returning({ id: extractedThemes.id })
  return deleted.length
}
