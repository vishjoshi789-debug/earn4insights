import { db } from '@/db'
import { extractedThemes } from '@/db/schema'
import { eq, desc, and, lt, sql } from 'drizzle-orm'

export type ThemeRow = {
  id: string
  productId: string
  theme: string
  mentionCount: number
  sentiment: string
  examples: string[]
  totalFeedbackAnalyzed: number
  extractedAt: Date
  extractionMethod: string
  createdAt: Date
}

/**
 * Save extracted themes for a product (replaces old themes for that product)
 */
export async function saveExtractedThemes(
  productId: string,
  themes: {
    theme: string
    mentionCount: number
    sentiment: string
    examples: string[]
    totalFeedbackAnalyzed: number
    extractionMethod: string
  }[]
): Promise<void> {
  // Delete existing themes for this product, then insert new ones
  await db.delete(extractedThemes).where(eq(extractedThemes.productId, productId))

  if (themes.length === 0) return

  const rows = themes.map((t) => ({
    productId,
    theme: t.theme,
    mentionCount: t.mentionCount,
    sentiment: t.sentiment,
    examples: t.examples,
    totalFeedbackAnalyzed: t.totalFeedbackAnalyzed,
    extractionMethod: t.extractionMethod,
  }))

  await db.insert(extractedThemes).values(rows)
}

/**
 * Get the latest extracted themes for a single product
 */
export async function getThemesForProduct(productId: string): Promise<ThemeRow[]> {
  const rows = await db
    .select()
    .from(extractedThemes)
    .where(eq(extractedThemes.productId, productId))
    .orderBy(desc(extractedThemes.mentionCount))

  return rows.map(mapRow)
}

/**
 * Get themes for multiple products at once
 */
export async function getThemesForProducts(
  productIds: string[]
): Promise<Record<string, ThemeRow[]>> {
  if (productIds.length === 0) return {}

  const rows = await db
    .select()
    .from(extractedThemes)
    .where(
      sql`${extractedThemes.productId} IN (${sql.join(
        productIds.map((id) => sql`${id}`),
        sql`, `
      )})`
    )
    .orderBy(desc(extractedThemes.mentionCount))

  const grouped: Record<string, ThemeRow[]> = {}
  for (const row of rows) {
    const mapped = mapRow(row)
    if (!grouped[mapped.productId]) grouped[mapped.productId] = []
    grouped[mapped.productId].push(mapped)
  }

  return grouped
}

/**
 * Delete themes older than the given number of days
 */
export async function cleanupOldThemes(olderThanDays: number = 90): Promise<number> {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - olderThanDays)

  const result = await db
    .delete(extractedThemes)
    .where(lt(extractedThemes.extractedAt, cutoff))

  return (result as any)?.rowCount ?? 0
}

function mapRow(row: typeof extractedThemes.$inferSelect): ThemeRow {
  return {
    id: row.id,
    productId: row.productId,
    theme: row.theme,
    mentionCount: row.mentionCount,
    sentiment: row.sentiment,
    examples: (row.examples ?? []) as string[],
    totalFeedbackAnalyzed: row.totalFeedbackAnalyzed,
    extractedAt: row.extractedAt,
    extractionMethod: row.extractionMethod,
    createdAt: row.createdAt,
  }
}
