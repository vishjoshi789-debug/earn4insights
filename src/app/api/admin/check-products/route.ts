import { NextResponse } from 'next/server'
import { getProducts } from '@/lib/product/store'
import { getAllResponses } from '@/lib/survey/responseStore'

export async function GET() {
  try {
    const products = await getProducts()
    const responses = await getAllResponses()

    const productStats = products.map(p => ({
      id: p.id,
      name: p.name,
      category: p.profile?.data?.category || 'NOT ASSIGNED',
      hasCategory: !!p.profile?.data?.category,
      responseCount: responses.filter(r => r.productId === p.id).length,
    }))

    const summary = {
      totalProducts: products.length,
      productsWithCategories: productStats.filter(p => p.hasCategory).length,
      productsWithoutCategories: productStats.filter(p => !p.hasCategory).length,
      totalResponses: responses.length,
      productStats,
    }

    return NextResponse.json(summary, { status: 200 })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to check products', details: String(error) },
      { status: 500 }
    )
  }
}
