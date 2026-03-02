import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { db } from '@/db'
import { products } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { notifyIdealConsumers } from '@/lib/personalization/smartDistributionService'

/**
 * POST /api/notifications/product-launch/[productId]
 *
 * Triggered after a brand launches a product.
 * Finds ideal consumers using ALL available data points and notifies them.
 *
 * Auth: brand owner of the product only
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { productId } = await params

    // Verify the caller owns the product
    const [product] = await db
      .select({ id: products.id, ownerId: products.ownerId, name: products.name })
      .from(products)
      .where(eq(products.id, productId))
      .limit(1)

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    if (product.ownerId !== session.user.id) {
      return NextResponse.json({ error: 'Not your product' }, { status: 403 })
    }

    // Find ideal consumers & notify
    const result = await notifyIdealConsumers(productId, 'product_launch', {
      maxNotifications: 50,
    })

    return NextResponse.json({
      success: true,
      notified: result.notified,
      topScores: result.topScores,
      message: `Notified ${result.notified} ideal consumers about "${product.name}"`,
    })
  } catch (error) {
    console.error('[ProductLaunchNotify] Error:', error)
    return NextResponse.json(
      { error: 'Failed to notify consumers' },
      { status: 500 }
    )
  }
}
