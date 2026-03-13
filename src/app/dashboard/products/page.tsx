import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getProducts } from '@/lib/product/store'
import { auth } from '@/lib/auth/auth.config'
import { db } from '@/db'
import { feedback } from '@/db/schema'
import { eq, sql, count, inArray } from 'drizzle-orm'

type ProductStats = {
  totalCount: number
  avgRating: number
  audioCount: number
  videoCount: number
  mixedCount: number
}

/** Batch-fetch feedback stats for all products in one query */
async function getBulkFeedbackStats(
  productIds: string[]
): Promise<Map<string, ProductStats>> {
  const result = new Map<string, ProductStats>()
  if (productIds.length === 0) return result

  try {
    const rows = await db
      .select({
        productId: feedback.productId,
        totalCount: count(),
        avgRating: sql<number>`COALESCE(AVG(${feedback.rating}), 0)`,
        audioCount: sql<number>`COUNT(*) FILTER (WHERE ${feedback.modalityPrimary} = 'audio')`,
        videoCount: sql<number>`COUNT(*) FILTER (WHERE ${feedback.modalityPrimary} = 'video')`,
        mixedCount: sql<number>`COUNT(*) FILTER (WHERE ${feedback.modalityPrimary} = 'mixed')`,
      })
      .from(feedback)
      .where(inArray(feedback.productId, productIds))
      .groupBy(feedback.productId)

    for (const r of rows) {
      result.set(r.productId, {
        totalCount: Number(r.totalCount),
        avgRating: Number(r.avgRating),
        audioCount: Number(r.audioCount),
        videoCount: Number(r.videoCount),
        mixedCount: Number(r.mixedCount),
      })
    }
  } catch {
    // Fallback without modality column
    try {
      const rows = await db
        .select({
          productId: feedback.productId,
          totalCount: count(),
          avgRating: sql<number>`COALESCE(AVG(${feedback.rating}), 0)`,
        })
        .from(feedback)
        .where(inArray(feedback.productId, productIds))
        .groupBy(feedback.productId)

      for (const r of rows) {
        result.set(r.productId, {
          totalCount: Number(r.totalCount),
          avgRating: Number(r.avgRating),
          audioCount: 0,
          videoCount: 0,
          mixedCount: 0,
        })
      }
    } catch {
      // DB not ready
    }
  }
  return result
}

export default async function ProductsPage() {
  const result = await getProducts()
  const session = await auth()
  const userRole = (session?.user as any)?.role as string | undefined

  // 🛡️ Absolute safety guard
  const products = Array.isArray(result) ? result : []

  // Fetch feedback stats for all products in one go
  const productIds = products.map((p: any) => p.id).filter(Boolean)
  const statsMap = await getBulkFeedbackStats(productIds)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Products</h1>
          <p className="text-muted-foreground">
            {userRole === 'consumer'
              ? 'Browse products and share your feedback to earn rewards'
              : 'All launched products'}
          </p>
        </div>

        {userRole === 'brand' ? (
          <Button asChild>
            <Link href="/dashboard/launch">Launch new product</Link>
          </Button>
        ) : (
          <Button asChild>
            <Link href="/dashboard/submit-feedback">Submit Feedback</Link>
          </Button>
        )}
      </div>

      {products.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No products launched yet.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {products.map((product: any) => {
            const stats = statsMap.get(product.id)
            const hasMedia =
              stats && (stats.audioCount > 0 || stats.videoCount > 0 || stats.mixedCount > 0)

            return (
              <Card key={product.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="text-base sm:text-lg">{product.name}</CardTitle>
                    {stats && stats.totalCount > 0 && (
                      <div className="flex items-center gap-2">
                        {/* Rating stars */}
                        <div className="flex items-center gap-0.5">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <span
                              key={s}
                              className={`text-sm ${
                                s <= Math.round(stats.avgRating)
                                  ? 'text-yellow-400'
                                  : 'text-gray-300'
                              }`}
                            >
                              ★
                            </span>
                          ))}
                          <span className="text-xs text-muted-foreground ml-1">
                            {stats.avgRating.toFixed(1)}
                          </span>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {stats.totalCount} review{stats.totalCount !== 1 ? 's' : ''}
                        </Badge>
                      </div>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span>
                      Platform: {product.platform || '—'} • Launched{' '}
                      {product.created_at
                        ? new Date(product.created_at).toLocaleDateString()
                        : '—'}
                    </span>

                    {/* Modality icons for brand */}
                    {userRole === 'brand' && hasMedia && (
                      <span className="flex gap-1 text-xs">
                        {stats.audioCount > 0 && <span>🎤 {stats.audioCount}</span>}
                        {stats.videoCount > 0 && <span>🎥 {stats.videoCount}</span>}
                        {stats.mixedCount > 0 && <span>📎 {stats.mixedCount}</span>}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/dashboard/products/${product.id}`}>
                        View details
                      </Link>
                    </Button>
                    {userRole === 'consumer' && (
                      <Button asChild size="sm">
                        <Link
                          href={`/dashboard/submit-feedback?productId=${product.id}&productName=${encodeURIComponent(product.name)}`}
                        >
                          Give Feedback
                        </Link>
                      </Button>
                    )}
                    {userRole === 'brand' && stats && stats.totalCount > 0 && (
                      <Button asChild size="sm">
                        <Link href={`/dashboard/products/${product.id}/feedback`}>
                          View Feedback
                        </Link>
                      </Button>
                    )}
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
