import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { isAdminSession } from '@/lib/auth/roles'
import { getConsumerIntelligence } from '@/lib/analytics/segmentedAnalytics'
import { db } from '@/db'
import { products } from '@/db/schema'
import { eq } from 'drizzle-orm'

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

    // Verify the requesting user owns this product (brand role check)
    const product = await db
      .select({ ownerId: products.ownerId })
      .from(products)
      .where(eq(products.id, productId))
      .limit(1)

    if (!product[0]) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    // Only brand owners can view consumer intelligence for their products.
    // Fail CLOSED on a missing owner_id: this previously read
    // `if (ownerId && ownerId !== session.user.id)`, the same fail-open bug as
    // the sibling segments route, so every unclaimed product's consumer
    // intelligence was readable by any authenticated user (products.owner_id is
    // nullable by design — schema.ts:72). Admin bypass per lib/auth/roles.ts.
    if (!isAdminSession(session)) {
      if (!product[0].ownerId || product[0].ownerId !== session.user.id) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 })
      }
    }

    const result = await getConsumerIntelligence(productId)

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'private, s-maxage=300, stale-while-revalidate=600',
      },
    })
  } catch (error) {
    console.error('[ConsumerIntelligence API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to generate consumer intelligence' },
      { status: 500 }
    )
  }
}
