import { auth } from '@/lib/auth/auth.config'
import { redirect } from 'next/navigation'
import { db } from '@/db'
import { userProfiles, products } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { getPersonalizedRecommendations } from '@/server/personalizationEngine'
import { RecommendationCard } from '@/components/recommendation-card'
import { Sparkles, TrendingUp, AlertCircle } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

// This page uses auth(), which requires headers() - mark as dynamic
export const dynamic = 'force-dynamic'

export default async function RecommendationsPage() {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      redirect('/api/auth/signin')
    }

    // Get user profile (optional — page works without one)
    let hasProfile = false
    try {
      const userProfile = await db
        .select()
        .from(userProfiles)
        .where(eq(userProfiles.id, session.user.id))
        .limit(1)
      hasProfile = !!(userProfile[0]?.onboardingComplete)
    } catch (err) {
      console.error('[Recommendations] Error fetching profile (non-fatal):', err)
    }

    // Get personalized recommendations
  let recommendations: Array<{
    productId: string
    score: number
    reasons: string[]
  }> = []
  
  try {
    recommendations = await getPersonalizedRecommendations(session.user.id, 20)
    
    // If no personalized recommendations, fall back to trending products
    if (recommendations.length === 0) {
      console.log('[Recommendations] No personalized recs, falling back to trending products')
      const trendingProducts = await db.select().from(products).limit(20)
      recommendations = trendingProducts.map(p => ({
        productId: p.id,
        score: 50, // Moderate score for trending
        reasons: ['Trending product', 'Popular with other users']
      }))
    }
  } catch (error: any) {
    // Let Next.js redirects pass through (e.g. from consent enforcement)
    if (error?.digest?.includes('NEXT_REDIRECT')) throw error
    console.error('[Recommendations] Error fetching:', error)
    // Fallback to showing some products
    const fallbackProducts = await db.select().from(products).limit(10)
    recommendations = fallbackProducts.map(p => ({
      productId: p.id,
      score: 30,
      reasons: ['Suggested product', 'Explore to get personalized recommendations']
    }))
  }

  // Fetch full product details
  const productIds = recommendations.map(r => r.productId)
  let productDetails: any[] = []
  
  if (productIds.length > 0) {
    productDetails = await db
      .select()
      .from(products)
      .where(eq(products.id, productIds[0])) // We'll do this properly below
  }

  // Fetch all products and match them
  const allProducts = await db.select().from(products)
  const productMap = new Map(allProducts.map(p => [p.id, p]))

  const recommendationsWithProducts = recommendations
    .map(rec => ({
      ...rec,
      product: productMap.get(rec.productId)
    }))
    .filter(rec => rec.product) // Only include products that exist

  // Categorize by score
  const highMatch = recommendationsWithProducts.filter(r => r.score >= 70)
  const goodMatch = recommendationsWithProducts.filter(r => r.score >= 50 && r.score < 70)
  const otherMatch = recommendationsWithProducts.filter(r => r.score < 50)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-headline font-bold mb-2 flex items-center gap-2">
          <Sparkles className="h-8 w-8 text-purple-500" />
          For You
        </h1>
        <p className="text-muted-foreground">
          Personalized product recommendations based on your interests and activity
        </p>
      </div>

      {!hasProfile && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Complete Your Profile for Better Matches</AlertTitle>
          <AlertDescription>
            Tell us about your interests so we can personalize your recommendations.
            <div className="mt-3">
              <Button asChild size="sm">
                <Link href="/onboarding">Complete Profile</Link>
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {recommendationsWithProducts.length === 0 ? (
        <Alert>
          <TrendingUp className="h-4 w-4" />
          <AlertTitle>Welcome! Let's Find Your Perfect Matches</AlertTitle>
          <AlertDescription>
            Complete your profile and explore products to get personalized recommendations tailored just for you.
            <div className="flex gap-2 mt-4">
              <Button asChild size="sm">
                <Link href="/onboarding">Complete Profile</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href="/public-products">Explore Products</Link>
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : (
        <div className="space-y-8">
          {/* High Match (70%+) */}
          {highMatch.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="h-5 w-5 text-purple-600" />
                <h2 className="text-2xl font-semibold">Perfect Matches</h2>
                <span className="text-sm text-muted-foreground">({highMatch.length})</span>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {highMatch.map((rec) => (
                  <RecommendationCard
                    key={rec.productId}
                    product={rec.product!}
                    score={rec.score}
                    reasons={rec.reasons}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Good Match (50-69%) */}
          {goodMatch.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="h-5 w-5 text-purple-500" />
                <h2 className="text-2xl font-semibold">Good Matches</h2>
                <span className="text-sm text-muted-foreground">({goodMatch.length})</span>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {goodMatch.map((rec) => (
                  <RecommendationCard
                    key={rec.productId}
                    product={rec.product!}
                    score={rec.score}
                    reasons={rec.reasons}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Other Matches (<50%) */}
          {otherMatch.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <h2 className="text-2xl font-semibold">You Might Also Like</h2>
                <span className="text-sm text-muted-foreground">({otherMatch.length})</span>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {otherMatch.map((rec) => (
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
        </div>
      )}

      {/* How This Works */}
      <Alert className="bg-purple-900/50 border-purple-700">
        <Sparkles className="h-4 w-4 text-purple-600" />
        <AlertTitle className="text-purple-900 dark:text-purple-100">
          How Recommendations Work
        </AlertTitle>
        <AlertDescription className="text-purple-800 dark:text-purple-200">
          We analyze your interests, survey responses, and product views to find the best matches. 
          The match percentage shows how well a product aligns with your preferences.
        </AlertDescription>
      </Alert>
    </div>
  )
  } catch (error: any) {
    // Let Next.js redirects pass through — redirect() throws a special error
    if (error?.digest?.includes('NEXT_REDIRECT')) throw error
    console.error('[Recommendations] Fatal error:', error)
    return (
      <div className="space-y-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error Loading Recommendations</AlertTitle>
          <AlertDescription>
            {error instanceof Error ? error.message : 'An unexpected error occurred. Please try again later.'}
          </AlertDescription>
        </Alert>
      </div>
    )
  }
}
