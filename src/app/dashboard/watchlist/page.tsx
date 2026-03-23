import { auth } from '@/lib/auth/auth.config'
import { redirect } from 'next/navigation'
import { getWatchlist } from '@/server/watchlistService'
import { Card, CardContent } from '@/components/ui/card'
import { BellOff } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { WatchlistItems } from '@/components/watchlist-items'

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
        <WatchlistItems
          entries={entries.map((entry) => ({
            id: entry.id,
            productId: entry.productId,
            productName: entry.productName || null,
            watchType: entry.watchType,
            desiredFeature: entry.desiredFeature || null,
            createdAt: entry.createdAt instanceof Date ? entry.createdAt.toISOString() : String(entry.createdAt),
            notifiedAt: entry.notifiedAt ? (entry.notifiedAt instanceof Date ? entry.notifiedAt.toISOString() : String(entry.notifiedAt)) : null,
          }))}
        />
      )}
    </div>
  )
}
