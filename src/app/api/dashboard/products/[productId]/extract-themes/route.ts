import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { extractThemesForProduct } from '@/server/themeExtractionService'
import { saveExtractedThemes } from '@/db/repositories/themeRepository'

/** POST /api/dashboard/products/[productId]/extract-themes - Manual trigger */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ productId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { productId } = await params
    const result = await extractThemesForProduct(productId)

    if (result.themes.length === 0) {
      return NextResponse.json({ success: true, message: 'No themes found', themes: [], totalFeedbackAnalyzed: result.totalFeedbackAnalyzed })
    }

    await saveExtractedThemes(productId, result.themes, {
      totalFeedbackAnalyzed: result.totalFeedbackAnalyzed,
      extractedAt: result.extractedAt,
    })

    return NextResponse.json({ success: true, themes: result.themes, totalFeedbackAnalyzed: result.totalFeedbackAnalyzed, extractedAt: result.extractedAt })
  } catch (error) {
    console.error('Theme extraction API error:', error)
    return NextResponse.json({ error: 'Failed to extract themes' }, { status: 500 })
  }
}
