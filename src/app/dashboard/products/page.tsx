import Link from 'next/link';
import { mockProducts, mockFeedback } from '@/lib/data';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart3, FileText, ArrowRight } from 'lucide-react';

// Simple helper: compute review stats for each product
function getProductStats(productId: string) {
  const feedbackForProduct = mockFeedback.filter((f) => f.productId === productId);

  if (feedbackForProduct.length === 0) {
    return {
      count: 0,
      averageRating: null as number | null,
    };
  }

  const total = feedbackForProduct.reduce((sum, f) => sum + f.rating, 0);
  const avg = total / feedbackForProduct.length;

  return {
    count: feedbackForProduct.length,
    averageRating: Number(avg.toFixed(1)),
  };
}

export default function DashboardProductsPage() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-headline font-bold">
            Products
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage your products and view detailed analytics reports.
          </p>
        </div>
      </div>

      {/* Product list */}
      <div className="grid gap-4 md:gap-6 lg:grid-cols-2">
        {mockProducts.map((product) => {
          const stats = getProductStats(product.id);

          return (
            <Card key={product.id} className="flex flex-col h-full">
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-2">
                  <span>{product.name}</span>
                  <span className="text-sm font-normal text-muted-foreground">
  {typeof product.price === 'number'
    ? `$${product.price.toFixed(2)}`
    : 'Price not set'}
</span>
                </CardTitle>
                <CardDescription className="line-clamp-2">
                  {product.description}
                </CardDescription>
              </CardHeader>

              <CardContent className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium flex items-center gap-1.5">
                    <BarChart3 className="h-4 w-4" />
                    {stats.count > 0 ? (
                      <>
                        <span>{stats.count} review{stats.count > 1 ? 's' : ''}</span>
                        <span className="text-muted-foreground">·</span>
                        <span>
                          Avg rating:{' '}
                          <span className="font-semibold">
                            {stats.averageRating}
                          </span>
                          /5
                        </span>
                      </>
                    ) : (
                      <span className="text-muted-foreground">
                        No reviews yet
                      </span>
                    )}
                  </p>
                </div>
              </CardContent>

              <CardFooter className="flex justify-between gap-4">
                {/* View report: /dashboard/report/[id] */}
                <Button asChild variant="outline" size="sm">
                  <Link href={`/dashboard/report/${product.id}`}>
                    <FileText className="mr-2 h-4 w-4" />
                    View detailed report
                  </Link>
                </Button>

                {/* Public page: /products/[id] */}
                <Button asChild size="sm">
                  <Link href={`/products/${product.id}`}>
                    View public page
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
