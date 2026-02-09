import { NextResponse } from 'next/server'
import { extractThemesForProduct } from '@/server/themeExtractionService'
import { saveExtractedThemes } from '@/db/repositories/themeRepository'
import { db } from '@/db'
import { products } from '@/db/schema'
import { ne } from 'drizzle-orm'

/** GET /api/cron/extract-themes - Weekly cron (Sunday 2 AM UTC) */
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const allProducts = await db.select({ id: products.id, name: products.name }).from(products).where(ne(products.lifecycleStatus, 'merged'))
    const results = { total: allProducts.length, processed: 0, skipped: 0, failed: 0 }

    for (const product of allProducts) {
      try {
        const extraction = await extractThemesForProduct(product.id)
        if (extraction.themes.length === 0) { results.skipped++; continue }
        await saveExtractedThemes(product.id, extraction.themes, { totalFeedbackAnalyzed: extraction.totalFeedbackAnalyzed, extractedAt: extraction.extractedAt })
        results.processed++
      } catch {
        results.failed++
      }
      await new Promise((r) => setTimeout(r, 2000)) // Rate limit
    }

    return NextResponse.json({ success: true, results, timestamp: new Date().toISOString() })
  } catch (error) {
    return NextResponse.json({ error: 'Theme extraction failed' }, { status: 500 })
  }
}
