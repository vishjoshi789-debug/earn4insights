import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { getCategoryIntelligence } from '@/lib/analytics/categoryIntelligence'
import { PRODUCT_CATEGORIES } from '@/lib/categories'
import type { ProductCategory } from '@/lib/categories'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ category: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { category: rawCategory } = await params
    const category = rawCategory?.toUpperCase() as ProductCategory
    if (!category || !PRODUCT_CATEGORIES[category]) {
      return NextResponse.json(
        { error: 'Invalid category', validCategories: Object.keys(PRODUCT_CATEGORIES) },
        { status: 400 }
      )
    }

    const result = await getCategoryIntelligence(category)

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    })
  } catch (error) {
    console.error('[CategoryIntelligence API] Error:', error)
    return NextResponse.json({ error: 'Failed to generate category intelligence' }, { status: 500 })
  }
}
