import { notFound, redirect } from 'next/navigation'
import { auth } from '@/lib/auth/auth.config'
import { db } from '@/db'
import {
  products,
  feedback as feedbackTable,
  socialPosts as socialPostsTable,
  surveyResponses,
  rankingHistory,
  feedbackMedia,
  communityPosts,
} from '@/db/schema'
import { eq, and, inArray, desc } from 'drizzle-orm'
import { ProductAnalytics } from '@/components/product-analytics'
import { Logo } from '@/components/logo'
import { PrintButton } from './PrintButton'
import type { Feedback, SocialPost } from '@/lib/data'

export const dynamic = 'force-dynamic'

export default async function ReportPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: productId } = await params

  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const [product] = await db
    .select()
    .from(products)
    .where(and(eq(products.id, productId), eq(products.ownerId, session.user.id)))
    .limit(1)

  if (!product) notFound()

  // Fetch all data in parallel
  const [rawFeedback, rawSocialPosts, rawSurveys, rawRankings, rawCommunity] = await Promise.all([
    db.select().from(feedbackTable).where(eq(feedbackTable.productId, productId)),
    db.select().from(socialPostsTable).where(eq(socialPostsTable.productId, productId)),
    db.select().from(surveyResponses).where(eq(surveyResponses.productId, productId)),
    db
      .select()
      .from(rankingHistory)
      .where(eq(rankingHistory.productId, productId))
      .orderBy(desc(rankingHistory.weekStart)),
    db.select().from(communityPosts).where(eq(communityPosts.productId, productId)),
  ])

  // Fetch media for these feedbacks
  const feedbackIds = rawFeedback.map((f) => f.id)
  const rawMedia =
    feedbackIds.length > 0
      ? await db
          .select()
          .from(feedbackMedia)
          .where(
            and(eq(feedbackMedia.ownerType, 'feedback'), inArray(feedbackMedia.ownerId, feedbackIds)),
          )
      : []

  // ─── Map to component props ────────────────────────────────────

  const mappedFeedback: Feedback[] = rawFeedback.map((f) => ({
    id: f.id,
    productId: f.productId,
    userName: f.userName ?? 'Anonymous',
    userAvatar: '',
    rating: f.rating ?? 0,
    text: f.feedbackText,
    timestamp: f.createdAt.toISOString(),
    analysis: {
      sentiment: (f.sentiment as 'positive' | 'negative' | 'neutral') ?? 'neutral',
      sentimentScore: f.sentiment === 'positive' ? 0.8 : f.sentiment === 'negative' ? -0.6 : 0.1,
      authenticityScore: 1,
      isPotentiallyFake: false,
      reason: '',
    },
  }))

  const categoryMap: Record<string, SocialPost['analysis']['category']> = {
    product_feedback: 'Product Feedback',
    brand_mention: 'Brand Mention',
    customer_support: 'Customer Support',
  }
  const mappedSocialPosts: SocialPost[] = rawSocialPosts.map((p) => ({
    id: p.id,
    productId: p.productId,
    platform: p.platform as SocialPost['platform'],
    userName: p.author ?? 'Unknown',
    userHandle: p.authorHandle ?? '',
    userAvatar: p.authorAvatar ?? '',
    text: p.content,
    likes: p.likes,
    shares: p.shares,
    comments: p.comments,
    timestamp: (p.postedAt ?? p.createdAt).toISOString(),
    analysis: {
      sentiment: (p.sentiment as 'positive' | 'negative' | 'neutral') ?? 'neutral',
      sentimentScore: p.sentimentScore ?? 0,
      influenceScore: p.influenceScore ?? 0,
      isKeyOpinionLeader: p.isKeyOpinionLeader,
      category: categoryMap[p.category ?? ''] ?? 'Other',
    },
  }))

  // Survey/NPS data
  const mappedSurveys = rawSurveys.map((s) => ({
    npsScore: s.npsScore,
    sentiment: (s.sentiment as 'positive' | 'negative' | 'neutral') ?? 'neutral',
    submittedAt: s.submittedAt.toISOString(),
  }))

  // Ranking history
  const mappedRankings = rawRankings.map((r) => ({
    weekStart: r.weekStart.toISOString(),
    rank: r.rank,
    score: r.score,
    category: r.category,
  }))

  // Media counts
  const mediaCounts = {
    audio: rawMedia.filter((m) => m.mediaType === 'audio').length,
    video: rawMedia.filter((m) => m.mediaType === 'video').length,
    total: rawMedia.length,
  }

  // Mention types from social posts
  const mentionTypes = rawSocialPosts.reduce<Record<string, number>>((acc, p) => {
    const type = p.postType ?? 'mention'
    acc[type] = (acc[type] ?? 0) + 1
    return acc
  }, {})

  // Keyword frequency from social posts
  const keywordCounts = rawSocialPosts.reduce<Record<string, number>>((acc, p) => {
    const kws = (p.keywords as string[]) ?? []
    kws.forEach((kw) => {
      acc[kw] = (acc[kw] ?? 0) + 1
    })
    return acc
  }, {})

  // Engagement totals
  const engagement = {
    views: rawSocialPosts.reduce((s, p) => s + (p.views ?? 0), 0),
    likes: rawSocialPosts.reduce((s, p) => s + p.likes, 0),
    shares: rawSocialPosts.reduce((s, p) => s + p.shares, 0),
    comments: rawSocialPosts.reduce((s, p) => s + p.comments, 0),
  }

  // Key opinion leaders
  const kols = rawSocialPosts
    .filter((p) => p.isKeyOpinionLeader)
    .map((p) => ({
      author: p.author ?? 'Unknown',
      handle: p.authorHandle ?? '',
      platform: p.platform,
      followers: p.authorFollowers ?? 0,
      influenceScore: p.influenceScore ?? 0,
      content: p.content.slice(0, 120),
    }))

  // Community discussions
  const mappedCommunity = rawCommunity.map((c) => ({
    id: c.id,
    title: c.title,
    postType: c.postType,
    upvotes: c.upvotes,
    replyCount: c.replyCount,
    viewCount: c.viewCount,
    createdAt: c.createdAt.toISOString(),
  }))

  const now = new Date()

  return (
    <div className="bg-background px-4 py-6 sm:p-8 print:p-0">
      <div className="mx-auto max-w-4xl">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b pb-6 sm:pb-8 print:hidden">
          <div className="flex items-center gap-2">
            <Logo />
            <h1 className="font-headline text-xl sm:text-2xl font-bold">Earn4Insights</h1>
          </div>
          <PrintButton />
        </header>

        <main className="pt-8">
          <div className="mb-8 space-y-2">
            <h2 className="font-headline text-3xl font-bold">Product Deep Dive</h2>
            <p className="text-xl font-semibold text-primary">{product.name}</p>
            <p className="text-sm text-muted-foreground">
              Report generated on: {now.toLocaleDateString()}
            </p>
          </div>

          <ProductAnalytics
            productId={product.id}
            feedback={mappedFeedback}
            socialPosts={mappedSocialPosts}
            surveyResponses={mappedSurveys}
            rankings={mappedRankings}
            mediaCounts={mediaCounts}
            mentionTypes={mentionTypes}
            keywordCounts={keywordCounts}
            engagement={engagement}
            kols={kols}
            communityDiscussions={mappedCommunity}
          />
        </main>

        <footer className="mt-8 border-t pt-8 text-center text-xs text-muted-foreground">
          &copy; {now.getFullYear()} Earn4Insights | Confidential Report
        </footer>
      </div>
    </div>
  )
}
