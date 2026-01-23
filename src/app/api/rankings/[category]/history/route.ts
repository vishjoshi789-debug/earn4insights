import { NextRequest, NextResponse } from 'next/server'
import { getHistoricalRankings } from '@/server/rankings/rankingStore'
import type { ProductCategory } from '@/lib/categories'
import { PRODUCT_CATEGORIES } from '@/lib/categories'

export async function GET(
  request: NextRequest,
  { params }: { params: { category: string } }
) {
  try {
    const category = params.category.toUpperCase() as ProductCategory

    // Validate category
    if (!PRODUCT_CATEGORIES[category]) {
      return NextResponse.json(
        { error: 'Invalid category' },
        { status: 400 }
      )
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '10', 10)

    const history = await getHistoricalRankings(category, limit)

    return NextResponse.json(history)
  } catch (error) {
    console.error('Error fetching ranking history:', error)
    return NextResponse.json(
      { error: 'Failed to fetch ranking history' },
      { status: 500 }
    )
  }
}
