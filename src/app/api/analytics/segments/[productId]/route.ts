import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { getSegmentedAnalytics } from '@/lib/analytics/segmentedAnalytics'
import { db } from '@/db'
import { products } from '@/db/schema'
import { eq } from 'drizzle-orm'

const VALID_DIMENSIONS = ['age', 'gender', 'country', 'engagement', 'device'] as const
type Dimension = typeof VALID_DIMENSIONS[number]

export async function GET(
  request: NextRequest,
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

    const { searchParams } = new URL(request.url)
    const dimension = searchParams.get('dimension') as Dimension
    
    if (!dimension || !VALID_DIMENSIONS.includes(dimension)) {
      return NextResponse.json(
        { error: 'Invalid dimension', validDimensions: VALID_DIMENSIONS },
        { status: 400 }
      )
    }

    // Verify the requesting user owns this product
    const product = await db
      .select({ ownerId: products.ownerId })
      .from(products)
      .where(eq(products.id, productId))
      .limit(1)

    if (!product[0]) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    if (product[0].ownerId && product[0].ownerId !== session.user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const result = await getSegmentedAnalytics(productId, dimension)

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'private, s-maxage=300, stale-while-revalidate=600',
      },
    })
  } catch (error) {
    console.error('[SegmentedAnalytics API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to generate segmented analytics' },
      { status: 500 }
    )
  }
}
