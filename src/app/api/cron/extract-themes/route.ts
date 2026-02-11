import { NextResponse } from 'next/server'
import { extractThemesForAllProducts } from '@/server/themeExtractionService'

/**
 * Cron: Extract AI themes for all products with feedback
 *
 * Trigger: Vercel Cron (recommended weekly, Sundays at 2 AM UTC)
 * Manual trigger: GET /api/cron/extract-themes
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await extractThemesForAllProducts()

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      processed: result.processed,
      errors: result.errors,
      summary: result.results.map((r) => ({
        productId: r.productId,
        themeCount: r.themes.length,
        feedbackAnalyzed: r.totalFeedbackAnalyzed,
        method: r.method,
      })),
    })
  } catch (error) {
    console.error('[ExtractThemesCron] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}
