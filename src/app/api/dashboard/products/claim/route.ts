import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import {
  claimProduct,
  getProductById,
  getClaimableProducts,
  getProductsByOwner,
} from '@/db/repositories/productRepository'

/**
 * GET /api/dashboard/products/claim
 * 
 * List claimable products (pending verification, unclaimed)
 * Brand owners can browse these and claim their products
 */
export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')
    
    if (action === 'my-products') {
      // Get products owned by this brand
      const owned = await getProductsByOwner(session.user.id)
      return NextResponse.json({
        products: owned.map(p => ({
          id: p.id,
          name: p.name,
          description: p.description,
          lifecycleStatus: p.lifecycleStatus,
          claimedAt: p.claimedAt,
          creationSource: p.creationSource,
        })),
      })
    }
    
    // Default: list claimable products
    const claimable = await getClaimableProducts()
    
    return NextResponse.json({
      products: claimable.map(p => ({
        id: p.id,
        name: p.name,
        description: p.description,
        lifecycleStatus: p.lifecycleStatus,
        creationSource: p.creationSource,
        created_at: p.created_at,
      })),
      totalClaimable: claimable.length,
    })
  } catch (error) {
    console.error('Claim list error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch claimable products' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/dashboard/products/claim
 * 
 * Claim a product (brand takes ownership)
 * 
 * Body: { productId: string }
 * 
 * Flow:
 * 1. Verify user is authenticated
 * 2. Verify product exists and is claimable
 * 3. Assign ownership to brand
 * 4. Mark product as verified
 */
export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const body = await request.json()
    const { productId } = body
    
    if (!productId || typeof productId !== 'string') {
      return NextResponse.json(
        { error: 'productId is required' },
        { status: 400 }
      )
    }
    
    // Check product exists
    const product = await getProductById(productId)
    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      )
    }
    
    // Check product is claimable
    if (!product.claimable) {
      return NextResponse.json(
        { error: 'This product is not available for claiming' },
        { status: 409 }
      )
    }
    
    if (product.lifecycleStatus === 'merged') {
      return NextResponse.json(
        { error: 'This product has been merged into another product' },
        { status: 409 }
      )
    }
    
    // Claim the product
    const claimed = await claimProduct(productId, session.user.id)
    
    if (!claimed) {
      return NextResponse.json(
        { error: 'Failed to claim product' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      success: true,
      product: {
        id: claimed.id,
        name: claimed.name,
        lifecycleStatus: claimed.lifecycleStatus,
        ownerId: claimed.ownerId,
        claimedAt: claimed.claimedAt,
      },
      message: `Successfully claimed "${claimed.name}". You can now manage this product.`,
    })
  } catch (error) {
    console.error('Claim product error:', error)
    return NextResponse.json(
      { error: 'Failed to claim product' },
      { status: 500 }
    )
  }
}
