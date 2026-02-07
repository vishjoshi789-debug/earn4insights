import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import {
  mergeProduct,
  findPotentialDuplicates,
  getProductById,
  getProductsByStatus,
} from '@/db/repositories/productRepository'
import { db } from '@/db'
import { surveyResponses, feedback, surveys } from '@/db/schema'
import { eq } from 'drizzle-orm'

/**
 * GET /api/dashboard/products/merge?productId=xxx
 * 
 * Find potential duplicates for a given product
 * Admin tool for reviewing and merging duplicates
 */
export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const { searchParams } = new URL(request.url)
    const productId = searchParams.get('productId')
    const action = searchParams.get('action')
    
    // List all pending verification products (admin review queue)
    if (action === 'pending-review') {
      const pending = await getProductsByStatus('pending_verification')
      return NextResponse.json({
        products: pending.map(p => ({
          id: p.id,
          name: p.name,
          description: p.description,
          lifecycleStatus: p.lifecycleStatus,
          creationSource: p.creationSource,
          createdBy: p.createdBy,
          created_at: p.created_at,
          claimable: p.claimable,
        })),
        total: pending.length,
      })
    }
    
    // Find duplicates for a specific product
    if (!productId) {
      return NextResponse.json(
        { error: 'productId query parameter is required' },
        { status: 400 }
      )
    }
    
    const product = await getProductById(productId)
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }
    
    const duplicates = await findPotentialDuplicates(product.name, productId)
    
    return NextResponse.json({
      product: {
        id: product.id,
        name: product.name,
        lifecycleStatus: product.lifecycleStatus,
      },
      potentialDuplicates: duplicates.map(d => ({
        id: d.id,
        name: d.name,
        description: d.description,
        lifecycleStatus: d.lifecycleStatus,
        matchScore: d.matchScore,
        creationSource: d.creationSource,
        ownerId: d.ownerId,
      })),
    })
  } catch (error) {
    console.error('Merge lookup error:', error)
    return NextResponse.json(
      { error: 'Failed to find duplicates' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/dashboard/products/merge
 * 
 * Merge a duplicate product into a canonical product
 * 
 * Body: { sourceId: string, targetId: string }
 * 
 * This will:
 * 1. Mark source product as 'merged' with mergedIntoId = targetId
 * 2. Migrate all survey_responses from source to target
 * 3. Migrate all feedback from source to target
 * 4. Migrate all surveys from source to target
 */
export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const body = await request.json()
    const { sourceId, targetId } = body
    
    if (!sourceId || !targetId) {
      return NextResponse.json(
        { error: 'sourceId and targetId are required' },
        { status: 400 }
      )
    }
    
    if (sourceId === targetId) {
      return NextResponse.json(
        { error: 'Cannot merge a product into itself' },
        { status: 400 }
      )
    }
    
    // Verify both products exist
    const source = await getProductById(sourceId)
    const target = await getProductById(targetId)
    
    if (!source) {
      return NextResponse.json({ error: 'Source product not found' }, { status: 404 })
    }
    if (!target) {
      return NextResponse.json({ error: 'Target product not found' }, { status: 404 })
    }
    if (source.lifecycleStatus === 'merged') {
      return NextResponse.json({ error: 'Source product is already merged' }, { status: 409 })
    }
    if (target.lifecycleStatus === 'merged') {
      return NextResponse.json({ error: 'Target product is already merged' }, { status: 409 })
    }
    
    // Migrate data: survey_responses
    const migratedResponses = await db
      .update(surveyResponses)
      .set({ productId: targetId })
      .where(eq(surveyResponses.productId, sourceId))
    
    // Migrate data: feedback
    const migratedFeedback = await db
      .update(feedback)
      .set({ productId: targetId })
      .where(eq(feedback.productId, sourceId))
    
    // Migrate data: surveys
    const migratedSurveys = await db
      .update(surveys)
      .set({ productId: targetId })
      .where(eq(surveys.productId, sourceId))
    
    // Mark source as merged
    const result = await mergeProduct(sourceId, targetId)
    
    return NextResponse.json({
      success: true,
      message: `Merged "${source.name}" into "${target.name}"`,
      source: {
        id: sourceId,
        name: source.name,
        status: 'merged',
      },
      target: {
        id: targetId,
        name: target.name,
      },
      migratedData: {
        note: 'Survey responses, feedback, and surveys have been migrated to the target product',
      },
    })
  } catch (error) {
    console.error('Merge product error:', error)
    return NextResponse.json(
      { error: 'Failed to merge products' },
      { status: 500 }
    )
  }
}
