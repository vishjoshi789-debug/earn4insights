import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { getProducts } from '@/lib/product/store'

export default async function ProductsPage() {
  const result = await getProducts()

  // 🛡️ Absolute safety guard
  const products = Array.isArray(result) ? result : []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Products</h1>
          <p className="text-muted-foreground">
            All launched products
          </p>
        </div>

        <Button asChild>
          <Link href="/dashboard/launch">Launch new product</Link>
        </Button>
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
            <Card key={product.id}>
              <CardHeader>
                <CardTitle>{product.name}</CardTitle>
              </CardHeader>

              <CardContent className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Platform: {product.platform || '—'} • Launched on{' '}
                  {product.created_at
                    ? new Date(product.created_at).toLocaleDateString()
                    : '—'}
                </div>

                <Button asChild size="sm" variant="outline">
                  <Link href={`/dashboard/products/${product.id}`}>
                    View details
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
