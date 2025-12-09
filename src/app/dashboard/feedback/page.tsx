import Link from 'next/link';
import { mockProducts, mockFeedback } from '@/lib/data';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { StarRating } from '@/components/star-rating';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';

function getProductStats(productId: string) {
  const feedback = mockFeedback.filter(
    (f) => f.productId === productId && !f.analysis.isPotentiallyFake
  );

  if (feedback.length === 0) {
    return {
      count: 0,
      averageRating: 0,
      latest: null as (typeof feedback)[number] | null,
      positiveCount: 0,
      negativeCount: 0,
      neutralCount: 0,
    };
  }

  const sumRating = feedback.reduce((sum, f) => sum + f.rating, 0);
  const averageRating = sumRating / feedback.length;

  const sortedByTime = [...feedback].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
  const latest = sortedByTime[0];

  const positiveCount = feedback.filter((f) => f.analysis.sentiment === 'positive').length;
  const negativeCount = feedback.filter((f) => f.analysis.sentiment === 'negative').length;
  const neutralCount = feedback.filter((f) => f.analysis.sentiment === 'neutral').length;

  return {
    count: feedback.length,
    averageRating,
    latest,
    positiveCount,
    negativeCount,
    neutralCount,
  };
}

export default function FeedbackDashboardPage() {
  const productsWithFeedback = mockProducts.map((product) => {
    const stats = getProductStats(product.id);
    return { product, stats };
  });

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl md:text-3xl font-headline font-bold">
          Feedback Overview
        </h1>
        <p className="text-muted-foreground">
          See consolidated customer feedback by product. Click “View report” for
          detailed analytics.
        </p>
      </header>

      <div className="grid gap-4 md:gap-6 md:grid-cols-2 xl:grid-cols-3">
        {productsWithFeedback.map(({ product, stats }) => (
          <Card key={product.id} className="flex flex-col">
            <CardHeader className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-semibold leading-tight">{product.name}</h2>
                {stats.count > 0 ? (
                  <Badge variant="outline">{stats.count} reviews</Badge>
                ) : (
                  <Badge variant="outline" className="opacity-70">
                    No reviews yet
                  </Badge>
                )}
              </div>

              {stats.count > 0 && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <StarRating rating={stats.averageRating} />
                    <span className="text-sm text-muted-foreground">
                      {stats.averageRating.toFixed(1)} / 5
                    </span>
                  </div>
                  <div className="flex gap-1 text-[11px] text-muted-foreground">
                    <span>👍 {stats.positiveCount}</span>
                    <span>· 😐 {stats.neutralCount}</span>
                    <span>· 👎 {stats.negativeCount}</span>
                  </div>
                </div>
              )}
            </CardHeader>

            <CardContent className="flex-1 flex flex-col justify-between gap-4">
              {stats.latest ? (
                <div className="space-y-1 text-sm">
                  <p className="font-medium">{stats.latest.userName}</p>
                  <p className="text-muted-foreground line-clamp-3">
                    “{stats.latest.text}”
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(stats.latest.timestamp), {
                      addSuffix: true,
                    })}
                    {' · '}
                    {stats.latest.analysis.sentiment.toUpperCase()}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No feedback yet for this product.
                </p>
              )}

              <div className="flex justify-between items-center pt-2 border-t mt-2">
                <span className="text-xs text-muted-foreground">
                  Price: ${product.price.toFixed(2)}
                </span>
                <Link
                  href={`/dashboard/report/${product.id}`}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  View report →
                </Link>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
