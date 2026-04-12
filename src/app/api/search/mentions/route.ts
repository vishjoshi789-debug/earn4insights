/**
 * Mention Search API
 * GET /api/search/mentions?q=searchTerm&type=all
 *
 * Searches brands (users with role=brand), products, product categories,
 * and influencer profiles by name. Returns max 3 per type (12 total).
 *
 * Auth required.
 */

import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { db } from '@/db'
import { users, products, influencerProfiles } from '@/db/schema'
import { ilike, eq, or, and } from 'drizzle-orm'

// Static category list derived from platform taxonomy
const PLATFORM_CATEGORIES = [
  { id: 'fitness', name: 'Fitness', slug: 'fitness' },
  { id: 'wellness', name: 'Wellness', slug: 'wellness' },
  { id: 'beauty', name: 'Beauty', slug: 'beauty' },
  { id: 'skincare', name: 'Skincare', slug: 'skincare' },
  { id: 'tech', name: 'Tech', slug: 'tech' },
  { id: 'food', name: 'Food', slug: 'food' },
  { id: 'travel', name: 'Travel', slug: 'travel' },
  { id: 'fashion', name: 'Fashion', slug: 'fashion' },
  { id: 'home', name: 'Home', slug: 'home' },
  { id: 'parenting', name: 'Parenting', slug: 'parenting' },
  { id: 'finance', name: 'Finance', slug: 'finance' },
  { id: 'education', name: 'Education', slug: 'education' },
  { id: 'gaming', name: 'Gaming', slug: 'gaming' },
  { id: 'sports', name: 'Sports', slug: 'sports' },
  { id: 'music', name: 'Music', slug: 'music' },
  { id: 'art', name: 'Art', slug: 'art' },
  { id: 'sustainability', name: 'Sustainability', slug: 'sustainability' },
  { id: 'health', name: 'Health', slug: 'health' },
]

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const q = request.nextUrl.searchParams.get('q')?.trim() ?? ''
    if (!q) {
      return NextResponse.json({ categories: [], brands: [], products: [], influencers: [] })
    }

    const pattern = `%${q}%`

    // Run all 3 DB queries in parallel
    const [brandRows, productRows, influencerRows] = await Promise.all([
      // Brands: users with role='brand' whose name matches
      db
        .select({ id: users.id, name: users.name })
        .from(users)
        .where(and(eq(users.role, 'brand'), ilike(users.name, pattern)))
        .limit(3),

      // Products: by name
      db
        .select({ id: products.id, name: products.name })
        .from(products)
        .where(ilike(products.name, pattern))
        .limit(3),

      // Influencers: by displayName
      db
        .select({ id: influencerProfiles.id, displayName: influencerProfiles.displayName })
        .from(influencerProfiles)
        .where(ilike(influencerProfiles.displayName, pattern))
        .limit(3),
    ])

    // Filter categories client-side (static list, no DB needed)
    const categoryResults = PLATFORM_CATEGORIES
      .filter(c => c.name.toLowerCase().includes(q.toLowerCase()))
      .slice(0, 3)

    return NextResponse.json({
      categories: categoryResults,
      brands: brandRows.map(b => ({ id: b.id, name: b.name ?? 'Unknown Brand' })),
      products: productRows.map(p => ({ id: p.id, name: p.name })),
      influencers: influencerRows.map(i => ({ id: i.id, displayName: i.displayName })),
    })
  } catch (error) {
    console.error('[Mentions GET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
