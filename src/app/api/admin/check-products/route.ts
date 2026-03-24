import { NextRequest, NextResponse } from 'next/server'
import { getAllProducts } from '@/db/repositories/productRepository'
import { db } from '@/db'
import { surveyResponses } from '@/db/schema'
import { sql } from 'drizzle-orm'
import { authenticateAdmin, unauthorizedResponse } from '@/lib/auth'

export async function GET(request: NextRequest) {
  if (!authenticateAdmin(request)) return unauthorizedResponse()
  try {
    const products = await getAllProducts()

    // Get response counts per product in one query
    const counts = await db
      .select({
        productId: surveyResponses.productId,
        count: sql<number>`count(*)::int`,
      })
      .from(surveyResponses)
      .groupBy(surveyResponses.productId)

    const countMap = new Map(counts.map(c => [c.productId, c.count]))

    const productStats = products.map(p => ({
      id: p.id,
      name: p.name,
      category: p.profile?.data?.category || 'NOT ASSIGNED',
      hasCategory: !!p.profile?.data?.category,
      responseCount: countMap.get(p.id) || 0,
    }))

    const summary = {
      totalProducts: products.length,
      productsWithCategories: productStats.filter(p => p.hasCategory).length,
      productsWithoutCategories: productStats.filter(p => !p.hasCategory).length,
      totalResponses: counts.reduce((sum, c) => sum + c.count, 0),
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
