// src/app/dashboard/page.tsx

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { auth } from '@/lib/auth/auth.config';
import { db } from '@/db';
import { userProfiles, products } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getPersonalizedRecommendations } from '@/server/personalizationEngine';
import { RecommendationCard } from '@/components/recommendation-card';
import { Sparkles, ArrowRight } from 'lucide-react';

export default async function DashboardPage() {
  const session = await auth();
  
  // Fetch recommendations if user is logged in
  let topRecommendations: Array<{
    productId: string;
    score: number;
    reasons: string[];
    product?: any;
  }> = [];

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
            Products we think you'll love based on your interests
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
            <CardTitle>Brand Analytics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Comprehensive insights: demographics, NPS, audience breakdown.
            </p>
            <Button asChild size="sm">
              <Link href="/dashboard/analytics">
                View analytics
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Product Reports</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Individual product-level reports and analytics.
            </p>
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/detailed-analytics">
                View reports
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Social & Community</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">
              (Coming from VM snapshot later — social feed, community posts, etc.)
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
