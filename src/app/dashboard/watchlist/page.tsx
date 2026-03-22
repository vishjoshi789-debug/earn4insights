import { auth } from '@/lib/auth/auth.config'
import { redirect } from 'next/navigation'
import { getWatchlist } from '@/server/watchlistService'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Bell, BellOff, Eye } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

const watchTypeLabels: Record<string, string> = {
  launch: '🚀 Launch',
  price_drop: '💰 Price Drop',
  feature: '✨ Feature',
  update: '🔄 Update',
  any: '📢 Any Change',
}

export default async function WatchlistPage() {
  const session = await auth()

  if (!session?.user?.id) {
    redirect('/api/auth/signin')
  }

  const entries = await getWatchlist(session.user.id)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-headline font-bold mb-2">My Watchlist</h1>
        <p className="text-muted-foreground">
          Products you&apos;re tracking for launches, updates, and price drops.
        </p>
      </div>

      {entries.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <BellOff className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No products watched yet</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-sm">
              Browse products and tap the bell icon to get notified about launches, updates, and more.
            </p>
            <Button asChild>
              <Link href="/dashboard/products">Browse products</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {entries.map((entry) => (
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
    </div>
  )
}
