'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Search } from 'lucide-react'

type ProductStats = {
  totalCount: number
  avgRating: number
  audioCount: number
  videoCount: number
  mixedCount: number
}

type ProductItem = {
  id: string
  name: string
  platform: string | null
  created_at: string | null
  stats: ProductStats | null
}

export function ProductsList({
  products,
  userRole,
}: {
  products: ProductItem[]
  userRole: string | undefined
}) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    if (!query.trim()) return products
    const q = query.toLowerCase()
    return products.filter((p) => p.name.toLowerCase().includes(q))
  }, [products, query])

  return (
    <>
      {/* Search bar */}
      {products.length > 0 && (
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Filter ${products.length} products…`}
            className="pl-9 text-base sm:text-sm"
          />
        </div>
      )}

      {/* Results */}
      {filtered.length === 0 && query ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No products matching &ldquo;{query}&rdquo;
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No products launched yet.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filtered.map((product) => {
            const stats = product.stats
            const hasMedia =
              stats && (stats.audioCount > 0 || stats.videoCount > 0 || stats.mixedCount > 0)

            return (
              <Card key={product.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="text-base sm:text-lg">{product.name}</CardTitle>
                    {stats && stats.totalCount > 0 && (
                      <div className="flex items-center gap-2">
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

                    {userRole === 'brand' && hasMedia && (
                      <span className="flex gap-1 text-xs">
                        {stats!.audioCount > 0 && <span>🎤 {stats!.audioCount}</span>}
                        {stats!.videoCount > 0 && <span>🎥 {stats!.videoCount}</span>}
                        {stats!.mixedCount > 0 && <span>📎 {stats!.mixedCount}</span>}
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
    </>
  )
}
