'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Bell, Eye, Search } from 'lucide-react'

const watchTypeLabels: Record<string, string> = {
  launch: '🚀 Launch',
  price_drop: '💰 Price Drop',
  feature: '✨ Feature',
  update: '🔄 Update',
  any: '📢 Any Change',
}

type WatchlistEntry = {
  id: string
  productId: string
  productName: string | null
  watchType: string
  desiredFeature: string | null
  createdAt: string
  notifiedAt: string | null
}

export function WatchlistItems({ entries }: { entries: WatchlistEntry[] }) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    if (!query.trim()) return entries
    const q = query.toLowerCase()
    return entries.filter(
      (e) =>
        (e.productName || '').toLowerCase().includes(q) ||
        (e.desiredFeature || '').toLowerCase().includes(q) ||
        (watchTypeLabels[e.watchType] || e.watchType).toLowerCase().includes(q)
    )
  }, [entries, query])

  return (
    <>
      {entries.length > 0 && (
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Filter ${entries.length} watched products…`}
            className="pl-9"
          />
        </div>
      )}

      {filtered.length === 0 && query ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No watchlist items matching &ldquo;{query}&rdquo;
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((entry) => (
            <Card key={entry.id} className="hover:border-purple-500/50 transition-colors">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Bell className="h-4 w-4 text-purple-500 flex-shrink-0" />
                    <CardTitle className="text-base truncate">
                      {entry.productName || 'Unknown Product'}
                    </CardTitle>
                  </div>
                  <Badge variant="secondary" className="text-xs flex-shrink-0">
                    {watchTypeLabels[entry.watchType] || entry.watchType}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0 space-y-3">
                {entry.desiredFeature && (
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">Watching for:</span>{' '}
                    {entry.desiredFeature}
                  </p>
                )}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    Added {new Date(entry.createdAt).toLocaleDateString()}
                  </span>
                  {entry.notifiedAt && (
                    <span>
                      Last notified {new Date(entry.notifiedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
                <Button asChild variant="outline" size="sm" className="w-full">
                  <Link href={`/dashboard/products/${entry.productId}`}>
                    <Eye className="h-3 w-3 mr-1" />
                    View product
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  )
}
