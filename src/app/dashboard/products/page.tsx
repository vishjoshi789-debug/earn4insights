import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { getProducts } from '@/lib/product/store'
import { auth } from '@/lib/auth/auth.config'

export default async function ProductsPage() {
  const result = await getProducts()
  const session = await auth()
  const userRole = (session?.user as any)?.role as string | undefined

  // 🛡️ Absolute safety guard
  const products = Array.isArray(result) ? result : []

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
          {products.map((product: any) => (
            <Card key={product.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle>{product.name}</CardTitle>
              </CardHeader>

              <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="text-sm text-muted-foreground">
                  Platform: {product.platform || '—'} • Launched on{' '}
                  {product.created_at
                    ? new Date(product.created_at).toLocaleDateString()
                    : '—'}
                </div>

                <div className="flex items-center gap-2">
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/dashboard/products/${product.id}`}>
                      View details
                    </Link>
                  </Button>
                  {userRole === 'consumer' && (
                    <Button asChild size="sm">
                      <Link href={`/dashboard/submit-feedback?productId=${product.id}&productName=${encodeURIComponent(product.name)}`}>
                        Give Feedback
                      </Link>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
