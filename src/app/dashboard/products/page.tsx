export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getProducts } from '@/server/products/productService'
import { auth } from '@/lib/auth/auth.config'
import { db } from '@/db'
import { feedback } from '@/db/schema'
import { eq, sql, count, inArray } from 'drizzle-orm'
import { ProductsList } from '@/components/products-list'

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

      <ProductsList
        products={products.map((product: any) => ({
          id: product.id,
          name: product.name,
          platform: product.platform || null,
          created_at: product.created_at || null,
          stats: statsMap.get(product.id) || null,
        }))}
        userRole={userRole}
      />
    </div>
  )
}
