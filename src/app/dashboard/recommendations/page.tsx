import { auth } from '@/lib/auth/auth.config'
import { redirect } from 'next/navigation'
import { db } from '@/db'
import { userProfiles, products } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { getPersonalizedRecommendations } from '@/server/personalizationEngine'
import { checkConsent } from '@/lib/consent-enforcement'
import { RecommendationCard } from '@/components/recommendation-card'
import { Sparkles, TrendingUp, AlertCircle, ShieldCheck } from 'lucide-react'
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

  // ══════════════════════════════════════════════════════════════
  // FOUR HONEST STATES. NEVER FABRICATE A SCORE OR A REASON.
  // ══════════════════════════════════════════════════════════════
  //
  // ⚠️ This page used to invent recommendations. Two fallbacks assigned
  // `score: 50` with reasons ['Trending product', 'Popular with other users']
  // and `score: 30` with ['Suggested product', ...]. Nothing was measured —
  // the "trending" query was `SELECT * FROM products LIMIT 20` with no
  // ordering and no popularity signal at all. "Popular with other users" was
  // a social-proof claim asserted about products that may have zero viewers.
  //
  // 🔴 THE WORSE HALF WAS CONSENT. `getPersonalizedRecommendations` calls
  // `enforceConsent(userId, 'personalization', ...)` which THROWS on denial —
  // and the catch block turned that refusal into fabricated cards. 8 of 9
  // consumers have not granted personalization consent, so nearly every
  // consumer saw invented recommendations: their decision honoured in the
  // engine and erased in the presentation. On a platform whose differentiator
  // is consent provenance, that is the defect that matters.
  //
  // ⚠️ CONSENT IS CHECKED HERE WITH THE NON-THROWING VARIANT, AND AGAIN IN
  // THE ENGINE. That duplication is deliberate. `enforceConsent` throws a
  // plain Error with a message string, so distinguishing "consent denied"
  // from "database down" would mean string-matching that message — fragile,
  // and it would silently resume fabricating the day someone rewords it.
  // `checkConsent` answers the question directly. The engine keeps its own
  // enforcement so the gate does not depend on every future caller
  // remembering to ask first: presentation decides what to SHOW, the engine
  // decides what it will COMPUTE.
  type ViewState = 'consent-off' | 'personalized' | 'catalogue' | 'no-products' | 'error'

  let viewState: ViewState = 'no-products'
  let errorMessage: string | null = null
  let recommendations: Array<{
    productId: string
    /** Present ONLY when personalization actually ran. Never invented. */
    score?: number
    /** Present ONLY when personalization actually ran. Never invented. */
    reasons?: string[]
  }> = []

  const allProducts = await db.select().from(products)
  const productMap = new Map(allProducts.map(p => [p.id, p]))

  const consent = await checkConsent(session.user.id, 'personalization')

  if (!consent.allowed) {
    // The consumer declined. Show them that, and nothing dressed as a
    // recommendation. No product grid — a grid under any heading reads as
    // recommendations, which is the thing they opted out of.
    viewState = 'consent-off'
  } else {
    try {
      const personalized = await getPersonalizedRecommendations(session.user.id, 20)
      if (personalized.length > 0) {
        recommendations = personalized
        viewState = 'personalized'
      } else if (allProducts.length > 0) {
        // Consented, but personalization produced nothing — too little signal.
        // Show the catalogue AS the catalogue: no score, no reasons, no
        // implied match.
        recommendations = allProducts.map(p => ({ productId: p.id }))
        viewState = 'catalogue'
      } else {
        viewState = 'no-products'
      }
    } catch (error: any) {
      // Next.js redirects throw — let them through.
      if (error?.digest?.includes('NEXT_REDIRECT')) throw error
      console.error('[Recommendations] Engine error:', error)
      // ⚠️ A genuine failure renders an ERROR, never products. Substituting
      // content for a failure is exactly how the fabrication began.
      viewState = 'error'
      errorMessage = error instanceof Error ? error.message : 'Unexpected error'
    }
  }

  const recommendationsWithProducts = recommendations
    .map(rec => ({ ...rec, product: productMap.get(rec.productId) }))
    .filter(rec => rec.product)

  // Score buckets apply ONLY to real scores. In 'catalogue' there are none,
  // so every row falls through to a single unscored list.
  const highMatch = viewState === 'personalized'
    ? recommendationsWithProducts.filter(r => (r.score ?? 0) >= 70) : []
  const goodMatch = viewState === 'personalized'
    ? recommendationsWithProducts.filter(r => (r.score ?? 0) >= 50 && (r.score ?? 0) < 70) : []
  const otherMatch = viewState === 'personalized'
    ? recommendationsWithProducts.filter(r => (r.score ?? 0) < 50) : []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-headline font-bold mb-2 flex items-center gap-2">
          <Sparkles className="h-8 w-8 text-purple-500" />
          For You
        </h1>
        {/* The subtitle must not claim personalization the page isn't doing. */}
        <p className="text-muted-foreground">
          {viewState === 'personalized'
            ? 'Personalized product recommendations based on your interests and activity'
            : viewState === 'catalogue'
              ? 'Browse the full catalogue — not enough activity yet to personalize'
              : 'Product recommendations'}
        </p>
      </div>

      {/* Profile nudge is irrelevant when consent is off — completing a profile
          would not produce recommendations, so offering it would mislead. */}
      {!hasProfile && viewState !== 'consent-off' && (
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

      {/* ── CONSENT OFF ────────────────────────────────────────────
          States the fact and links to where it can be changed. NO
          products, and deliberately NO "turn it on" button: this consumer
          already answered the consent question, and re-asking it on a page
          they opened for something else is pressure, not information. */}
      {viewState === 'consent-off' && (
        <Alert>
          <ShieldCheck className="h-4 w-4" />
          <AlertTitle>Personalized recommendations are turned off</AlertTitle>
          <AlertDescription>
            You haven&apos;t granted personalization consent, so we don&apos;t use your
            profile or activity to suggest products. That&apos;s your choice and we
            won&apos;t work around it.
            <div className="mt-3">
              <Button asChild size="sm" variant="outline">
                <Link href="/dashboard/privacy">Privacy &amp; Consent</Link>
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* ── GENUINE FAILURE — an error, never substituted content ── */}
      {viewState === 'error' && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Couldn&apos;t load recommendations</AlertTitle>
          <AlertDescription>
            {errorMessage ?? 'Please try again later.'}
          </AlertDescription>
        </Alert>
      )}

      {viewState === 'catalogue' && (
        <h2 className="text-2xl font-semibold">Explore the catalogue</h2>
      )}

      {viewState === 'consent-off' || viewState === 'error' ? null
        : recommendationsWithProducts.length === 0 ? (
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

          {/* ── CATALOGUE ────────────────────────────────────────
              Every match bucket is empty in this state by construction, so
              without this the page would render nothing. Cards are passed
              NO score and NO reasons — the component omits the match badge
              and reason list entirely rather than showing a zero or a
              placeholder. This is the catalogue presented as the catalogue. */}
          {viewState === 'catalogue' && (
            <section>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {recommendationsWithProducts.map((rec) => (
                  <RecommendationCard
                    key={rec.productId}
                    product={rec.product!}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* How This Works — describes personalization, so it only belongs on
          the page when personalization is what the consumer is looking at.
          Showing it beside an unscored catalogue would explain a match
          percentage that isn't there. */}
      {viewState === 'personalized' && (
        <Alert className="bg-slate-800 border-slate-600">
          <Sparkles className="h-4 w-4 text-purple-400" />
          <AlertTitle className="text-white font-bold">
            How Recommendations Work
          </AlertTitle>
          <AlertDescription className="text-slate-200">
            We analyze your interests, survey responses, and product views to find the best matches.
            The match percentage shows how well a product aligns with your preferences.
          </AlertDescription>
        </Alert>
      )}
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
