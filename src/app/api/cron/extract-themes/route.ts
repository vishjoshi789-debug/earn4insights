import { NextResponse } from 'next/server'
import { extractThemesForAllProducts } from '@/server/themeExtractionService'
import { logger } from '@/lib/logger'

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

    logger.cronResult('extract-themes', true, { processed: result.processed, errors: result.errors })

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
    logger.cronResult('extract-themes', false, { error: error instanceof Error ? error.message : String(error) })
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
