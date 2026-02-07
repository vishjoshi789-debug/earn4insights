import Link from 'next/link'
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDistanceToNow } from 'date-fns'
import { db } from '@/db'
import { feedback, products } from '@/db/schema'
import { eq, desc, sql, ne, count } from 'drizzle-orm'
import { ExternalLink, MessageSquare, Copy } from 'lucide-react'

// Aggregate stats per product
async function getProductFeedbackOverview() {
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
    .groupBy(feedback.productId)

  return rows
}

// Get the latest feedback item per product (for preview)
async function getLatestFeedbackPerProduct(productIds: string[]) {
  if (productIds.length === 0) return []

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
    .where(sql`${feedback.productId} = ANY(${productIds})`)
    .orderBy(desc(feedback.createdAt))
    .limit(productIds.length * 2) // Fetch extra, then dedupe per product

  // Dedupe: keep only the latest per productId
  const seen = new Set<string>()
  return latestItems.filter((item) => {
    if (seen.has(item.productId)) return false
    seen.add(item.productId)
    return true
  })
}

// Get all products (from DB)
async function getAllProductNames() {
  const rows = await db
    .select({
      id: products.id,
      name: products.name,
    })
    .from(products)
    .where(ne(products.lifecycleStatus, 'merged'))

  return new Map(rows.map((r) => [r.id, r.name]))
}

// Global totals
async function getGlobalFeedbackTotals() {
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

  return row
}

export default async function FeedbackDashboardPage() {
  const [overview, productNames, totals] = await Promise.all([
    getProductFeedbackOverview(),
    getAllProductNames(),
    getGlobalFeedbackTotals(),
  ])

  const productIds = overview.map((o) => o.productId)
  const latestFeedback = await getLatestFeedbackPerProduct(productIds)
  const latestMap = new Map(latestFeedback.map((f) => [f.productId, f]))

  // Sort: products with most feedback first
  const sorted = [...overview].sort(
    (a, b) => Number(b.totalCount) - Number(a.totalCount)
  )

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl md:text-3xl font-headline font-bold">
          Feedback Overview
        </h1>
        <p className="text-muted-foreground">
          Direct consumer feedback across all products. Click any product to see
          full feedback details.
        </p>
      </header>

      {/* Global Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{totals?.totalCount ?? 0}</div>
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
      </div>

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
                    <h2 className="font-semibold leading-tight">{productName}</h2>
                    <div className="flex items-center gap-1">
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
                      <p className="text-muted-foreground line-clamp-3">
                        &quot;{latest.feedbackText}&quot;
                      </p>
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
