import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { auth } from '@/lib/auth/auth.config'
import { getScheduledProductsByOwner } from '@/db/repositories/productRepository'
import LaunchForm from './LaunchForm'

function formatScheduled(iso?: string) {
  if (!iso) return 'Not set'
  const d = new Date(iso)
  return d.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export default async function LaunchProductPage({
  searchParams,
}: {
  searchParams: Promise<{ scheduled?: string }>
}) {
  const session = await auth()
  const userId = session?.user?.id
  const scheduled = userId ? await getScheduledProductsByOwner(userId) : []
  const params = await searchParams
  const justScheduled = params?.scheduled === '1'

  return (
    <div className="min-h-screen bg-muted/30 py-10">
      <div className="max-w-lg mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Launch a Product</h1>
          <p className="text-muted-foreground">
            Add a new product to start collecting feedback, NPS, and social insights.
          </p>
        </div>

        {justScheduled && (
          <div className="rounded-md border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-foreground">
            Scheduled — your product will go live at the time you picked.
            Brands and consumers won&apos;t see it until then.
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Product Basics</CardTitle>
          </CardHeader>

          <CardContent>
            <LaunchForm />
          </CardContent>
        </Card>

        {scheduled.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Your scheduled launches</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {scheduled.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-foreground truncate">{p.name}</div>
                    <div className="text-xs text-muted-foreground">
                      Goes live {formatScheduled(p.scheduledLaunchAt)}
                    </div>
                  </div>
                  <Link
                    href={`/dashboard/products/${p.id}`}
                    className="text-xs text-primary hover:underline shrink-0 ml-3"
                  >
                    Manage
                  </Link>
                </div>
              ))}
              <p className="text-xs text-muted-foreground pt-1">
                Scheduled products are hidden from consumers, rankings, and search
                until launch time. The publisher runs every 15 minutes, so the
                actual go-live happens within ~15 min of the scheduled time.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
