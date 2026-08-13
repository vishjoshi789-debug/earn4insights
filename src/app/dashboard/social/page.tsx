import { auth } from '@/lib/auth/auth.config'
import { redirect } from 'next/navigation'
import { db } from '@/db'
import { products, socialPosts } from '@/db/schema'
import { eq, inArray, desc, and, gte, sql } from 'drizzle-orm'
import { getSocialAggregateMetrics, getSocialTrends } from '@/db/repositories/socialRepository'
import { getSocialOverview } from '@/server/social/socialAnalyticsService'
import SocialPageClient, { type SocialPageData } from './SocialPageClient'

export default async function SocialPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const userId = session.user.id
  const userRole = (session.user as any).role || 'consumer'
  const isBrand = userRole === 'brand'

  // Get products (brand = owned products; consumer = all products with social enabled)
  let productIds: string[] = []
  let productNameMap: Record<string, string> = {}

  if (isBrand) {
    const brandProducts = await db
      .select({ id: products.id, name: products.name })
      .from(products)
      .where(eq(products.ownerId, userId))

    productIds = brandProducts.map((p) => p.id)
    for (const p of brandProducts) {
      productNameMap[p.id] = p.name
    }

    // ⚠️ REMOVED 2026-08-13 — the "show every social-enabled product" fallback.
    //
    // A brand that owned no products was shown up to 50 OTHER products' social
    // posts, inside their own dashboard, under their own "Social Mentions"
    // heading. That is misattribution: nothing distinguished those posts from
    // the brand's own, so a new brand's first impression of the feature was
    // other people's data presented as theirs.
    //
    // A brand with no products now gets the existing "No products found"
    // empty state, which is the truth.
  } else {
    // Consumer sees all products with social listening enabled
    const socialProducts = await db
      .select({ id: products.id, name: products.name })
      .from(products)
      .where(eq(products.socialListeningEnabled, true))
      .limit(50)

    productIds = socialProducts.map((p) => p.id)
    for (const p of socialProducts) {
      productNameMap[p.id] = p.name
    }
  }

  // Fetch initial posts and overview
  let posts: any[] = []
  let total = 0
  let overview: SocialPageData['overview'] = null

  if (productIds.length > 0) {
    const dateFrom = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    const [postsResult, countResult, overviewResult] = await Promise.all([
      db
        .select()
        .from(socialPosts)
        .where(inArray(socialPosts.productId, productIds))
        .orderBy(desc(socialPosts.postedAt))
        .limit(50),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(socialPosts)
        .where(inArray(socialPosts.productId, productIds)),
      getSocialOverview(productIds, 30).catch(() => null),
    ])

    posts = postsResult.map((p) => ({
      id: p.id,
      productId: p.productId,
      platform: p.platform,
      postType: p.postType,
      content: p.content,
      title: p.title,
      url: p.url,
      author: p.author,
      authorHandle: p.authorHandle,
      authorAvatar: p.authorAvatar,
      likes: p.likes,
      shares: p.shares,
      comments: p.comments,
      views: p.views,
      rating: p.rating,
      sentiment: p.sentiment,
      sentimentScore: p.sentimentScore,
      engagementScore: p.engagementScore,
      influenceScore: p.influenceScore,
      isKeyOpinionLeader: p.isKeyOpinionLeader,
      category: p.category,
      postedAt: p.postedAt?.toISOString() ?? null,
      createdAt: p.createdAt.toISOString(),
    }))

    total = countResult[0]?.count ?? 0
    overview = overviewResult
  }

  const data: SocialPageData = {
    posts,
    total,
    overview,
    productNames: productNameMap,
    hasProducts: productIds.length > 0,
    isBrand,
  }

  return <SocialPageClient data={data} />
}
