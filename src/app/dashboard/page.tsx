// src/app/dashboard/page.tsx

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { auth } from '@/lib/auth/auth.config';
import { db } from '@/db';
import { userProfiles, products, feedback } from '@/db/schema';
import { eq, sql, count } from 'drizzle-orm';
import { getPersonalizedRecommendations } from '@/server/personalizationEngine';
import { RecommendationCard } from '@/components/recommendation-card';
import { Sparkles, ArrowRight, MessageSquare, TrendingUp, BarChart3, ExternalLink } from 'lucide-react';

// Quick feedback totals for the dashboard
async function getDashboardFeedbackStats() {
  try {
    const [row] = await db
      .select({
        totalCount: count(),
        newCount: sql<number>`COUNT(*) FILTER (WHERE ${feedback.status} = 'new')`,
        positiveCount: sql<number>`COUNT(*) FILTER (WHERE ${feedback.sentiment} = 'positive')`,
        negativeCount: sql<number>`COUNT(*) FILTER (WHERE ${feedback.sentiment} = 'negative')`,
        avgRating: sql<number>`COALESCE(AVG(${feedback.rating}), 0)`,
      })
      .from(feedback);
    return row;
  } catch {
    return { totalCount: 0, newCount: 0, positiveCount: 0, negativeCount: 0, avgRating: 0 };
  }
}

export default async function DashboardPage() {
  const session = await auth();
  
  // Fetch recommendations and feedback stats in parallel
  let topRecommendations: Array<{
    productId: string;
    score: number;
    reasons: string[];
    product?: any;
  }> = [];

  const [feedbackStats] = await Promise.all([
    getDashboardFeedbackStats(),
    // Recommendations fetched below conditionally
  ]);

  if (session?.user?.id) {
    try {
      const recommendations = await getPersonalizedRecommendations(session.user.id, 3);
      
      if (recommendations.length > 0) {
        const allProducts = await db.select().from(products);
        const productMap = new Map(allProducts.map(p => [p.id, p]));
        
        topRecommendations = recommendations
          .map(rec => ({
            ...rec,
            product: productMap.get(rec.productId)
          }))
          .filter(rec => rec.product);
      }
    } catch (error) {
      console.error('[Dashboard] Error fetching recommendations:', error);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-headline font-bold mb-2">
          Brand Pulse Dashboard
        </h1>
        <p className="text-muted-foreground">
          Overview of your products, feedback, and community activity.
        </p>
      </div>

      {/* For You Section */}
      {topRecommendations.length > 0 && (
        <section className="bg-slate-900 rounded-lg p-6 border border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-purple-400" />
              <h2 className="text-2xl font-semibold text-white">For You</h2>
            </div>
            <Button asChild variant="ghost" size="sm" className="text-slate-200 hover:text-white">
              <Link href="/dashboard/recommendations" className="flex items-center gap-1">
                View all
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
          <p className="text-sm text-slate-300 mb-4">
            Products we think you&apos;ll love based on your interests
          </p>
          <div className="grid gap-4 md:grid-cols-3">
            {topRecommendations.map((rec) => (
              <RecommendationCard
                key={rec.productId}
                product={rec.product!}
                score={rec.score}
                reasons={rec.reasons}
                compact
              />
            ))}
          </div>
        </section>
      )}

      {/* Feedback Snapshot */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            Consumer Feedback
          </h2>
          <Button asChild variant="ghost" size="sm">
            <Link href="/dashboard/feedback" className="flex items-center gap-1 text-sm">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </Button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{feedbackStats?.totalCount ?? 0}</div>
              <p className="text-xs text-muted-foreground">Total Feedback</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-blue-600">
                  {feedbackStats?.newCount ?? 0}
                </span>
                {Number(feedbackStats?.newCount) > 0 && (
                  <Badge className="bg-blue-600 text-white text-[10px]">needs review</Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">Unreviewed</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">
                {Number(feedbackStats?.avgRating ?? 0).toFixed(1)} <span className="text-sm text-muted-foreground">/ 5</span>
              </div>
              <p className="text-xs text-muted-foreground">Avg Rating</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-1 text-lg">
                <span className="text-green-600 font-bold">{feedbackStats?.positiveCount ?? 0}</span>
                <span className="text-muted-foreground text-sm">/</span>
                <span className="text-red-600 font-bold">{feedbackStats?.negativeCount ?? 0}</span>
              </div>
              <p className="text-xs text-muted-foreground">Positive / Negative</p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Products</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">
              View and explore your tracked products.
            </p>
            <Button asChild size="sm">
              <Link href="/dashboard/products">Go to products</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Unified Analytics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Aggregated insights across surveys and direct feedback.
            </p>
            <Button asChild size="sm">
              <Link href="/dashboard/analytics/unified">
                View analytics
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Surveys &amp; NPS
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Manage surveys and view multimodal response analytics.
            </p>
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/surveys">
                Manage surveys
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ExternalLink className="w-4 h-4" />
              Collect Feedback
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Share the public feedback page with consumers.
            </p>
            <Button asChild size="sm" variant="outline">
              <Link href="/submit-feedback" target="_blank">
                Open form
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
