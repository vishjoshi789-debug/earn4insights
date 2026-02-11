import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { extractThemesForProduct } from '@/server/themeExtractionService'

/**
 * POST /api/dashboard/products/[productId]/extract-themes
 *
 * Manually trigger theme extraction for a specific product.
 * Requires authentication.
 */
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

    if (!productId) {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 })
    }

    const result = await extractThemesForProduct(productId)

    return NextResponse.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[ExtractThemes] Error:', error)
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
