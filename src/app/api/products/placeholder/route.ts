import { NextResponse } from 'next/server'
import {
  createPlaceholderProduct,
  findPotentialDuplicates,
} from '@/db/repositories/productRepository'

/**
 * POST /api/products/placeholder
 * 
 * Create a placeholder product when a consumer submits feedback
 * for a product that doesn't exist in the system.
 * 
 * Flow:
 * 1. Consumer searches for product → no match found
 * 2. Consumer provides product name + optional category
 * 3. System checks for near-duplicates one more time
 * 4. If no duplicates: creates placeholder (pending_verification, claimable)
 * 5. If duplicates found: returns suggestions for consumer to pick
 * 
 * The placeholder can later be claimed by the brand.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, description, category, categoryName, createdBy } = body
    
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return NextResponse.json(
        { error: 'Product name is required (min 2 characters)' },
        { status: 400 }
      )
    }
    
    const trimmedName = name.trim()
    
    // Check for near-duplicates before creating
    const duplicates = await findPotentialDuplicates(trimmedName)
    
    // If we find high-confidence matches, suggest them instead
    const highConfidenceMatches = duplicates.filter(d => d.matchScore >= 80)
    
    if (highConfidenceMatches.length > 0) {
      return NextResponse.json({
        created: false,
        message: 'Similar products found. Did you mean one of these?',
        suggestions: highConfidenceMatches.map(p => ({
          id: p.id,
          name: p.name,
          description: p.description || null,
          matchScore: p.matchScore,
          isVerified: p.lifecycleStatus === 'verified',
        })),
      })
    }
    
    // No high-confidence duplicates → create placeholder
    const placeholder = await createPlaceholderProduct({
      name: trimmedName,
      description: description || undefined,
      category: category || undefined,
      categoryName: categoryName || undefined,
      createdBy: createdBy || undefined,
    })
    
    return NextResponse.json({
      created: true,
      product: {
        id: placeholder.id,
        name: placeholder.name,
        lifecycleStatus: placeholder.lifecycleStatus,
        claimable: placeholder.claimable,
      },
      // Also return any low-confidence suggestions for awareness
      suggestions: duplicates
        .filter(d => d.matchScore < 80 && d.matchScore >= 50)
        .map(p => ({
          id: p.id,
          name: p.name,
          matchScore: p.matchScore,
        })),
    })
  } catch (error) {
    console.error('Placeholder creation error:', error)
    return NextResponse.json(
      { error: 'Failed to create product placeholder' },
      { status: 500 }
    )
  }
}
