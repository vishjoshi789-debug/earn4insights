import { NextRequest, NextResponse } from 'next/server'
import { generatePublicSummary } from '@/lib/analytics/publicSummary'

// Public route — no auth required (this is the public product summary)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
  try {
    const { productId } = await params
    if (!productId) {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 })
    }

    const summary = await generatePublicSummary(productId)

    return NextResponse.json(summary, {
      headers: {
        'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1200',
      },
    })
  } catch (error) {
    console.error('[PublicSummary API] Error:', error)
    return NextResponse.json({ error: 'Failed to generate summary' }, { status: 500 })
  }
}
