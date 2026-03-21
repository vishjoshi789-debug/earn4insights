import { auth } from '@/lib/auth/auth.config'
import { redirect } from 'next/navigation'
import { db } from '@/db'
import { products } from '@/db/schema'
import { eq } from 'drizzle-orm'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Package, ArrowRight } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function ProductDeepDivePage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const brandProducts = await db
    .select({
      id: products.id,
      name: products.name,
      description: products.description,
      platform: products.platform,
      feedbackEnabled: products.feedbackEnabled,
      socialListeningEnabled: products.socialListeningEnabled,
    })
    .from(products)
    .where(eq(products.ownerId, session.user.id))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-headline font-bold mb-2">Product Deep Dive</h1>
        <p className="text-muted-foreground">
          Select a product to explore its ratings, sentiment, social reach, and generate a printable report.
        </p>
      </div>

      {brandProducts.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">No products yet</p>
            <p className="text-sm mt-2">
              Launch a product to start getting deep analytics.
            </p>
            <Button asChild size="sm" className="mt-4">
              <Link href="/dashboard/launch">Launch a product</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {brandProducts.map((product) => (
            <Card key={product.id} className="flex flex-col">
              <CardHeader>
                <CardTitle className="truncate">{product.name}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col flex-1 space-y-3">
                {product.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2 flex-1">
                    {product.description}
                  </p>
                )}
                <div className="flex gap-2 flex-wrap">
                  {product.platform && (
                    <span className="text-xs bg-muted px-2 py-0.5 rounded-full">
                      {product.platform}
                    </span>
                  )}
                  {product.feedbackEnabled && (
                    <span className="text-xs bg-muted px-2 py-0.5 rounded-full">Feedback on</span>
                  )}
                  {product.socialListeningEnabled && (
                    <span className="text-xs bg-muted px-2 py-0.5 rounded-full">Social on</span>
                  )}
                </div>
                <Button asChild size="sm" variant="outline" className="w-full">
                  <Link href={`/dashboard/report/${product.id}`}>
                    View deep dive <ArrowRight className="h-3 w-3 ml-1" />
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
