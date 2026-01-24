import { NextRequest, NextResponse } from 'next/server'
import { getCurrentWeeklyRanking } from '@/server/rankings/rankingStore'
import type { ProductCategory } from '@/lib/categories'
import { PRODUCT_CATEGORIES } from '@/lib/categories'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ category: string }> }
) {
  try {
    const { category: categoryParam } = await params
    const category = categoryParam.toUpperCase() as ProductCategory

    // Validate category
    if (!PRODUCT_CATEGORIES[category]) {
      return NextResponse.json(
        { error: 'Invalid category' },
        { status: 400 }
      )
    }

    const ranking = await getCurrentWeeklyRanking(category)

    if (!ranking) {
      return NextResponse.json(
        { error: 'No rankings found for this category' },
        { status: 404 }
      )
    }

    return NextResponse.json(ranking)
  } catch (error) {
    console.error('Error fetching ranking:', error)
    return NextResponse.json(
      { error: 'Failed to fetch ranking' },
      { status: 500 }
    )
  }
}
