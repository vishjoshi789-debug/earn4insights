import { NextRequest, NextResponse } from 'next/server'
import { updateProductProfile } from '@/lib/product/store'
import type { ProductCategory } from '@/lib/categories'
import { PRODUCT_CATEGORIES } from '@/lib/categories'

export async function POST(request: NextRequest) {
  try {
    const { assignments } = await request.json()

    if (!assignments || !Array.isArray(assignments)) {
      return NextResponse.json(
        { error: 'Invalid assignments format' },
        { status: 400 }
      )
    }

    const results = []
    const errors = []

    for (const { productId, category } of assignments) {
      try {
        // Validate category
        if (!PRODUCT_CATEGORIES[category as ProductCategory]) {
          errors.push(`Invalid category for product ${productId}`)
          continue
        }

        // Update product category
        await updateProductProfile(productId, (profile) => ({
          ...profile,
          data: {
            ...profile.data,
            category,
          },
        }))

        results.push({ productId, category, success: true })
      } catch (error) {
        errors.push(`Failed to assign category to product ${productId}: ${error}`)
        results.push({ productId, category, success: false })
      }
    }

    return NextResponse.json({
      success: errors.length === 0,
      message: `Assigned categories to ${results.filter(r => r.success).length} products`,
      results,
      errors,
    })
  } catch (error) {
    console.error('Failed to assign categories:', error)
    return NextResponse.json(
      { error: 'Failed to assign categories', details: String(error) },
      { status: 500 }
    )
  }
}
