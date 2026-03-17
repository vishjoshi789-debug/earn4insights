import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { db } from '@/db'
import { products } from '@/db/schema'
import { eq, inArray } from 'drizzle-orm'
import {
  getSocialPosts,
  getSocialPostCount,
  getSocialAggregateMetrics,
  getSocialTrends,
  type SocialFilters,
} from '@/db/repositories/socialRepository'
import { getSocialOverview } from '@/server/social/socialAnalyticsService'

/**
 * GET /api/social — fetch social posts for brand's products
 *
 * Query params:
 *   platform - filter by platform
 *   sentiment - filter by sentiment
 *   search - text search
 *   limit - page size (default 50)
 *   offset - pagination offset
 *   view - 'posts' | 'overview' (default: posts)
 */
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const params = req.nextUrl.searchParams
  const view = params.get('view') || 'posts'

  // Get brand's product IDs
  const brandProducts = await db
    .select({ id: products.id })
    .from(products)
    .where(eq(products.ownerId, session.user.id))

  const productIds = brandProducts.map((p) => p.id)

  // Also support consumer view — show all products they've interacted with
  // For now, if no products owned, show all posts (consumer view)
  const filters: SocialFilters = {
    productIds: productIds.length > 0 ? productIds : undefined,
    platforms: params.get('platform') && params.get('platform') !== 'all'
      ? [params.get('platform')!] as any
      : undefined,
    sentiments: params.get('sentiment') && params.get('sentiment') !== 'all'
      ? [params.get('sentiment')!] as any
      : undefined,
    search: params.get('search') || undefined,
    limit: Math.min(Number(params.get('limit')) || 50, 100),
    offset: Number(params.get('offset')) || 0,
  }

  if (view === 'overview') {
    const overview = await getSocialOverview(productIds, 30)
    return NextResponse.json(overview)
  }

  const [posts, total] = await Promise.all([
    getSocialPosts(filters),
    getSocialPostCount(filters),
  ])

  return NextResponse.json({
    posts,
    total,
    limit: filters.limit,
    offset: filters.offset,
  })
}
