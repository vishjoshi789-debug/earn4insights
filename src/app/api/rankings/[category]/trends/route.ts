import { NextRequest, NextResponse } from 'next/server'
import { getProductRankingHistory } from '@/server/rankings/rankingStore'
import { getProducts } from '@/lib/product/store'
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

    // Get all products in this category
    const allProducts = await getProducts()
    const categoryProducts = allProducts.filter(p => 
      p.profile?.data?.category === category
    )

    // Get ranking history for each product
    const trends = await Promise.all(
      categoryProducts.map(async (product) => {
        const history = await getProductRankingHistory(product.id, category)
        return {
          productId: product.id,
          productName: product.name,
          history,
        }
      })
    )

    // Filter out products with no history
    const trendsWithData = trends.filter(t => t.history.length > 0)

    return NextResponse.json(trendsWithData)
  } catch (error) {
    console.error('Error fetching ranking trends:', error)
    return NextResponse.json(
      { error: 'Failed to fetch ranking trends' },
      { status: 500 }
    )
  }
}
