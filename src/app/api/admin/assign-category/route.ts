import { NextRequest, NextResponse } from 'next/server'
import { getProductById, updateProductProfile } from '@/db/repositories/productRepository'
import type { ProductCategory } from '@/lib/categories'
import { PRODUCT_CATEGORIES } from '@/lib/categories'

export async function POST(request: NextRequest) {
  try {
    const { productId, category } = await request.json()

    if (!productId || !category) {
      return NextResponse.json(
        { error: 'Missing productId or category' },
        { status: 400 }
      )
    }

    // Validate category
    if (!PRODUCT_CATEGORIES[category as ProductCategory]) {
      return NextResponse.json(
        { error: 'Invalid category' },
        { status: 400 }
      )
    }

    // Check if product exists
    const product = await getProductById(productId)

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      )
    }

    // Update product category via DB repository
    await updateProductProfile(productId, (profile) => ({
      ...profile,
      data: {
        ...profile.data,
        category,
      },
    }))

    return NextResponse.json({
      success: true,
      message: 'Category assigned successfully',
      productId,
      category,
    })
  } catch (error) {
    console.error('Failed to assign category:', error)
    return NextResponse.json(
      { error: 'Failed to assign category', details: String(error) },
      { status: 500 }
    )
  }
}
