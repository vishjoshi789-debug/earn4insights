import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { calculateBatchHealthScores } from '@/lib/analytics/productHealthScore'

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { productIds } = body

    if (!Array.isArray(productIds) || productIds.length === 0) {
      return NextResponse.json({ error: 'productIds array is required' }, { status: 400 })
    }

    if (productIds.length > 50) {
      return NextResponse.json({ error: 'Maximum 50 products per batch' }, { status: 400 })
    }

    const results = await calculateBatchHealthScores(productIds)
    const serialized = Object.fromEntries(results)

    return NextResponse.json(serialized, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    })
  } catch (error) {
    console.error('[HealthScore Batch API] Error:', error)
    return NextResponse.json({ error: 'Failed to compute batch health scores' }, { status: 500 })
  }
}
