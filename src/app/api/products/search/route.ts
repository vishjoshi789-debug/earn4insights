import { NextResponse } from 'next/server'
import { searchProductsByName } from '@/db/repositories/productRepository'

/**
 * GET /api/products/search?q=iPhone&limit=10
 * 
 * Public product search API with fuzzy matching
 * Used by:
 * - Consumer feedback form (to attach feedback to existing products)
 * - Brand onboarding (to check for existing products before creating)
 * 
 * Returns products sorted by match score (higher = better match)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q') || ''
    const limitParam = searchParams.get('limit')
    const limit = limitParam ? Math.min(parseInt(limitParam, 10), 20) : 10
    
    if (!query || query.trim().length < 2) {
      return NextResponse.json({
        results: [],
        query: query,
        message: 'Search query must be at least 2 characters',
      })
    }
    
    const results = await searchProductsByName(query.trim(), {
      limit,
      excludeMerged: true,
    })
    
    // Return safe public fields only (no owner info, no internal IDs)
    const publicResults = results.map(p => ({
      id: p.id,
      name: p.name,
      description: p.description || null,
      category: p.profile?.data?.productType || p.profile?.data?.category || null,
      categoryName: (p.profile as any)?.categoryName || null,
      matchScore: p.matchScore,
      lifecycleStatus: p.lifecycleStatus,
      // Show if product is verified (brand-confirmed) vs pending
      isVerified: p.lifecycleStatus === 'verified',
    }))
    
    return NextResponse.json({
      results: publicResults,
      query: query.trim(),
      totalResults: publicResults.length,
    })
  } catch (error) {
    console.error('Product search error:', error)
    return NextResponse.json(
      { error: 'Search failed', results: [] },
      { status: 500 }
    )
  }
}
