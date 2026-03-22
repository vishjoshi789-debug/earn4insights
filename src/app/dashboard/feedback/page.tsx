import Link from 'next/link'
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDistanceToNow } from 'date-fns'
import { db } from '@/db'
import { feedback, products, surveyResponses } from '@/db/schema'
import { eq, desc, sql, and, inArray, count } from 'drizzle-orm'
import { ExternalLink, MessageSquare, Copy, Mic, Video, BarChart3 } from 'lucide-react'
import { auth } from '@/lib/auth/auth.config'
import { redirect } from 'next/navigation'
import { getMediaForFeedbackIds } from '@/db/repositories/feedbackRepository'
import type { MediaItem } from '@/db/repositories/feedbackRepository'
import { getBrandSubscription } from '@/server/subscriptions/subscriptionService'
import UpgradePrompt from '@/app/dashboard/analytics/unified/UpgradePrompt'

// ── Data helpers (all filtered by brand's products) ──

/** Get the product IDs owned by this brand */
async function getBrandProductIds(brandId: string): Promise<string[]> {
  try {
    const rows = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.ownerId, brandId))
    return rows.map((r) => r.id)
  } catch {
    // Fallback: if owner_id column doesn't exist yet, return all products
    try {
      const rows = await db.select({ id: products.id }).from(products)
      return rows.map((r) => r.id)
    } catch {
      return []
    }
  }
}

// Aggregate stats per product
async function getProductFeedbackOverview(productIds: string[]) {
  if (productIds.length === 0) return []

  try {
    const rows = await db
      .select({
        productId: feedback.productId,
        totalCount: count(),
        avgRating: sql<number>`COALESCE(AVG(${feedback.rating}), 0)`,
        positiveCount: sql<number>`COUNT(*) FILTER (WHERE ${feedback.sentiment} = 'positive')`,
        negativeCount: sql<number>`COUNT(*) FILTER (WHERE ${feedback.sentiment} = 'negative')`,
        neutralCount: sql<number>`COUNT(*) FILTER (WHERE ${feedback.sentiment} = 'neutral')`,
        newCount: sql<number>`COUNT(*) FILTER (WHERE ${feedback.status} = 'new')`,
        textCount: sql<number>`COUNT(*) FILTER (WHERE ${feedback.modalityPrimary} = 'text')`,
        audioCount: sql<number>`COUNT(*) FILTER (WHERE ${feedback.modalityPrimary} = 'audio')`,
        videoCount: sql<number>`COUNT(*) FILTER (WHERE ${feedback.modalityPrimary} = 'video')`,
        mixedCount: sql<number>`COUNT(*) FILTER (WHERE ${feedback.modalityPrimary} = 'mixed')`,
        latestAt: sql<string>`MAX(${feedback.createdAt})`,
      })
      .from(feedback)
      .where(inArray(feedback.productId, productIds))
      .groupBy(feedback.productId)

    return rows
  } catch {
    // Fallback if modality_primary column doesn't exist yet
    try {
      const rows = await db
        .select({
          productId: feedback.productId,
          totalCount: count(),
          avgRating: sql<number>`COALESCE(AVG(${feedback.rating}), 0)`,
          positiveCount: sql<number>`COUNT(*) FILTER (WHERE ${feedback.sentiment} = 'positive')`,
          negativeCount: sql<number>`COUNT(*) FILTER (WHERE ${feedback.sentiment} = 'negative')`,
          neutralCount: sql<number>`COUNT(*) FILTER (WHERE ${feedback.sentiment} = 'neutral')`,
          newCount: sql<number>`COUNT(*) FILTER (WHERE ${feedback.status} = 'new')`,
          textCount: sql<number>`${count()}`,
          audioCount: sql<number>`0`,
          videoCount: sql<number>`0`,
          mixedCount: sql<number>`0`,
          latestAt: sql<string>`MAX(${feedback.createdAt})`,
        })
        .from(feedback)
        .where(inArray(feedback.productId, productIds))
        .groupBy(feedback.productId)

      return rows
    } catch {
      return []
    }
  }
}

// Get the latest feedback item per product (for preview)
async function getLatestFeedbackPerProduct(productIds: string[]) {
  if (productIds.length === 0) return []

  try {
    // Get the most recent feedback for each product
    const latestItems = await db
      .select({
        id: feedback.id,
        productId: feedback.productId,
        userName: feedback.userName,
        feedbackText: feedback.feedbackText,
        sentiment: feedback.sentiment,
        modalityPrimary: feedback.modalityPrimary,
        rating: feedback.rating,
        createdAt: feedback.createdAt,
      })
      .from(feedback)
      .where(inArray(feedback.productId, productIds))
      .orderBy(desc(feedback.createdAt))
      .limit(productIds.length * 2)

    const seen = new Set<string>()
    return latestItems.filter((item) => {
      if (seen.has(item.productId)) return false
      seen.add(item.productId)
      return true
    })
  } catch {
    // Fallback without modality column
    try {
      const latestItems = await db
        .select({
          id: feedback.id,
          productId: feedback.productId,
          userName: feedback.userName,
          feedbackText: feedback.feedbackText,
          sentiment: feedback.sentiment,
          modalityPrimary: sql<string>`'text'`.as('modality_primary'),
          rating: feedback.rating,
          createdAt: feedback.createdAt,
        })
        .from(feedback)
        .where(inArray(feedback.productId, productIds))
        .orderBy(desc(feedback.createdAt))
        .limit(productIds.length * 2)

      const seen = new Set<string>()
      return latestItems.filter((item) => {
        if (seen.has(item.productId)) return false
        seen.add(item.productId)
        return true
      })
    } catch {
      return []
    }
  }
}

// Get product names for the brand's products
async function getProductNames(productIds: string[]) {
  if (productIds.length === 0) return new Map<string, string>()

  try {
    const rows = await db
      .select({ id: products.id, name: products.name })
      .from(products)
      .where(inArray(products.id, productIds))
    return new Map(rows.map((r) => [r.id, r.name]))
  } catch {
    return new Map<string, string>()
  }
}

// Totals scoped to brand's products
async function getBrandFeedbackTotals(productIds: string[]) {
  if (productIds.length === 0) {
    return { totalCount: 0, avgRating: 0, newCount: 0, positiveCount: 0, negativeCount: 0, neutralCount: 0 }
  }

  try {
    const [row] = await db
      .select({
        totalCount: count(),
        avgRating: sql<number>`COALESCE(AVG(${feedback.rating}), 0)`,
        newCount: sql<number>`COUNT(*) FILTER (WHERE ${feedback.status} = 'new')`,
        positiveCount: sql<number>`COUNT(*) FILTER (WHERE ${feedback.sentiment} = 'positive')`,
        negativeCount: sql<number>`COUNT(*) FILTER (WHERE ${feedback.sentiment} = 'negative')`,
        neutralCount: sql<number>`COUNT(*) FILTER (WHERE ${feedback.sentiment} = 'neutral')`,
      })
      .from(feedback)
      .where(inArray(feedback.productId, productIds))

    return row
  } catch {
    return { totalCount: 0, avgRating: 0, newCount: 0, positiveCount: 0, negativeCount: 0, neutralCount: 0 }
  }
}

export default async function FeedbackDashboardPage() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect('/login')
  }

  // Get this brand's product IDs and subscription tier in parallel
  const [brandProductIds, subscription] = await Promise.all([
    getBrandProductIds(session.user.id),
    getBrandSubscription(session.user.id),
  ])

  const [overview, productNames, totals] = await Promise.all([
    getProductFeedbackOverview(brandProductIds),
    getProductNames(brandProductIds),
    getBrandFeedbackTotals(brandProductIds),
  ])

  // Survey response count for source breakdown
  let surveyCount = 0
  try {
    if (brandProductIds.length > 0) {
      const [row] = await db
        .select({ c: count() })
        .from(surveyResponses)
        .where(inArray(surveyResponses.productId, brandProductIds))
      surveyCount = row?.c ?? 0
    }
  } catch { /* table may not exist yet */ }

  // NPS calculation
  let npsScore: number | null = null
  try {
    if (brandProductIds.length > 0) {
      const npsRows = await db
        .select({ score: surveyResponses.npsScore })
        .from(surveyResponses)
        .where(inArray(surveyResponses.productId, brandProductIds))
      const valid = npsRows.filter((r) => r.score !== null)
      if (valid.length >= 1) {
        const promoters = valid.filter((r) => r.score! >= 9).length
        const detractors = valid.filter((r) => r.score! <= 6).length
        npsScore = Math.round(((promoters - detractors) / valid.length) * 100)
      }
    }
  } catch { /* nps_score column may not exist */ }

  const totalCombined = (totals?.totalCount ?? 0) + surveyCount

  const productIds = overview.map((o) => o.productId)
  const latestFeedback = await getLatestFeedbackPerProduct(productIds)
  const latestMap = new Map(latestFeedback.map((f) => [f.productId, f]))

  // Fetch media for the latest feedback items shown in previews
  const latestFeedbackIds = latestFeedback.map((f) => f.id)
  const mediaMap = await getMediaForFeedbackIds(latestFeedbackIds)

  // Sort: products with most feedback first
  const sorted = [...overview].sort(
    (a, b) => Number(b.totalCount) - Number(a.totalCount)
  )

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl md:text-3xl font-headline font-bold">
          Feedback Hub
        </h1>
        <p className="text-muted-foreground">
          All feedback sources — direct submissions and surveys — in one place.
        </p>
      </header>

      {/* Global Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{totalCombined}</div>
            <p className="text-xs text-muted-foreground">Total Feedback</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {Number(totals?.avgRating ?? 0).toFixed(1)}
            </div>
            <p className="text-xs text-muted-foreground">Avg Rating</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-blue-600">
              {totals?.newCount ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">Unreviewed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-1">
              <span className="text-green-600 font-bold text-lg">
                {totals?.positiveCount ?? 0}
              </span>
              <span className="text-muted-foreground">/</span>
              <span className="text-gray-600 font-bold text-lg">
                {totals?.neutralCount ?? 0}
              </span>
              <span className="text-muted-foreground">/</span>
              <span className="text-red-600 font-bold text-lg">
                {totals?.negativeCount ?? 0}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">+/=/- Sentiment</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{overview.length}</div>
            <p className="text-xs text-muted-foreground">Products with Feedback</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-1 text-sm">
              <MessageSquare className="h-3.5 w-3.5 text-blue-500" />
              <span className="font-bold">{totals?.totalCount ?? 0}</span>
              <span className="text-muted-foreground mx-0.5">·</span>
              <BarChart3 className="h-3.5 w-3.5 text-purple-500" />
              <span className="font-bold">{surveyCount}</span>
            </div>
            <p className="text-xs text-muted-foreground">Direct / Survey</p>
          </CardContent>
        </Card>
        {npsScore !== null && (
          <Card>
            <CardContent className="pt-6">
              <div className={`text-2xl font-bold ${
                npsScore >= 50 ? 'text-green-600' : npsScore >= 0 ? 'text-yellow-600' : 'text-red-600'
              }`}>
                {npsScore > 0 ? `+${npsScore}` : npsScore}
              </div>
              <p className="text-xs text-muted-foreground">NPS Score</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Pro Upgrade Prompt (free tier only) */}
      {subscription.tier === 'free' && (
        <UpgradePrompt
          title="Unlock Individual Feedback & Media Playback"
          description="You're viewing aggregate stats. Upgrade to Pro to dive into every response."
          currentTier={subscription.tier}
          features={[
            'Read full feedback text for every submission',
            'Play audio and video recordings from customers',
            'View customer contact details and metadata',
            'Export all feedback data to CSV',
            'Advanced filtering by sentiment, modality, and date',
          ]}
        />
      )}

      {/* Product Feedback Cards */}
      {sorted.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Feedback Yet</h3>
            <p className="text-muted-foreground mb-4">
              Share your product feedback link with consumers to start collecting feedback.
            </p>
            <Button asChild>
              <Link href="/dashboard/products">View Products</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:gap-6 md:grid-cols-2 xl:grid-cols-3">
          {sorted.map((stats) => {
            const productName =
              productNames.get(stats.productId) || `Product ${stats.productId.slice(0, 8)}`
            const latest = latestMap.get(stats.productId)

            return (
              <Card key={stats.productId} className="flex flex-col">
                <CardHeader className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="font-semibold leading-tight min-w-0 truncate">{productName}</h2>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Badge variant="outline">{stats.totalCount} reviews</Badge>
                      {Number(stats.newCount) > 0 && (
                        <Badge className="bg-blue-600 text-white text-xs">
                          {stats.newCount} new
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Rating + Sentiment */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <span
                          key={star}
                          className={`text-sm ${
                            star <= Math.round(Number(stats.avgRating))
                              ? 'text-yellow-400'
                              : 'text-gray-200'
                          }`}
                        >
                          ★
                        </span>
                      ))}
                      <span className="text-xs text-muted-foreground ml-1">
                        {Number(stats.avgRating).toFixed(1)}
                      </span>
                    </div>
                    <div className="flex gap-1 text-[11px] text-muted-foreground">
                      <span>👍 {stats.positiveCount}</span>
                      <span>· 😐 {stats.neutralCount}</span>
                      <span>· 👎 {stats.negativeCount}</span>
                    </div>
                  </div>

                  {/* Modality breakdown */}
                  <div className="flex gap-2 text-[11px] text-muted-foreground">
                    {Number(stats.textCount) > 0 && <span>💬 {stats.textCount} text</span>}
                    {Number(stats.audioCount) > 0 && <span>🎤 {stats.audioCount} audio</span>}
                    {Number(stats.videoCount) > 0 && <span>🎥 {stats.videoCount} video</span>}
                    {Number(stats.mixedCount) > 0 && <span>📎 {stats.mixedCount} mixed</span>}
                  </div>
                </CardHeader>

                <CardContent className="flex-1 flex flex-col justify-between gap-4">
                  {latest ? (
                    <div className="space-y-1 text-sm">
                      <p className="font-medium">
                        {latest.userName || 'Anonymous'}
                      </p>
                      <p className="text-muted-foreground line-clamp-3 overflow-hidden break-words">
                        &quot;{latest.feedbackText}&quot;
                      </p>

                      {/* Media Attachments (audio, video, images) */}
                      <FeedbackMediaSection media={mediaMap.get(latest.id) || []} />

                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {latest.sentiment && (
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${
                              latest.sentiment === 'positive'
                                ? 'bg-green-50 text-green-700 border-green-200'
                                : latest.sentiment === 'negative'
                                  ? 'bg-red-50 text-red-700 border-red-200'
                                  : 'bg-gray-50 text-gray-700 border-gray-200'
                            }`}
                          >
                            {latest.sentiment}
                          </Badge>
                        )}
                        <span>
                          {formatDistanceToNow(new Date(latest.createdAt), {
                            addSuffix: true,
                          })}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No feedback preview available.
                    </p>
                  )}

                  <div className="flex justify-between items-center pt-2 border-t mt-2">
                    <Link
                      href={`/submit-feedback/${stats.productId}`}
                      target="_blank"
                      className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Share link
                    </Link>
                    <Link
                      href={`/dashboard/products/${stats.productId}/feedback`}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      View all feedback →
                    </Link>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ── Media attachment renderer (audio / video / image) ── */
function FeedbackMediaSection({ media }: { media: MediaItem[] }) {
  if (media.length === 0) return null

  const audioItems = media.filter((m) => m.mediaType === 'audio')
  const videoItems = media.filter((m) => m.mediaType === 'video')
  const imageItems = media.filter((m) => m.mediaType === 'image')

  return (
    <div className="space-y-2 mt-2">
      {/* Audio player(s) */}
      {audioItems.map((a) => (
        <div key={a.id} className="flex items-center gap-2 bg-muted/40 rounded-lg p-2">
          <span className="text-sm">🎤</span>
          <audio controls preload="metadata" className="h-8 flex-1 min-w-0">
            <source src={a.storageKey} type={a.mimeType || 'audio/webm'} />
            Your browser does not support audio playback.
          </audio>
          {a.durationMs && (
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {Math.round(a.durationMs / 1000)}s
            </span>
          )}
        </div>
      ))}

      {/* Video player(s) */}
      {videoItems.map((v) => (
        <div key={v.id} className="rounded-lg overflow-hidden border bg-black">
          <video
            controls
            preload="metadata"
            className="w-full max-h-[200px]"
            playsInline
          >
            <source src={v.storageKey} type={v.mimeType || 'video/webm'} />
            Your browser does not support video playback.
          </video>
          {v.durationMs && (
            <div className="text-xs text-muted-foreground px-2 py-1 bg-muted/40">
              🎥 Video · {Math.round(v.durationMs / 1000)}s
            </div>
          )}
        </div>
      ))}

      {/* Image gallery */}
      {imageItems.length > 0 && (
        <div className={`grid gap-2 ${
          imageItems.length === 1 ? 'grid-cols-1' :
          imageItems.length === 2 ? 'grid-cols-2' :
          'grid-cols-3'
        }`}>
          {imageItems.map((img) => (
            <a
              key={img.id}
              href={img.storageKey}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-lg overflow-hidden border hover:ring-2 hover:ring-primary transition-all"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.storageKey}
                alt="Feedback attachment"
                className="w-full h-auto max-h-[150px] object-cover"
                loading="lazy"
              />
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
