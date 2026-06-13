// src/app/dashboard/page.tsx

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { auth } from '@/lib/auth/auth.config';
import { db } from '@/db';
import { userProfiles, products, feedback, userPoints, campaignInfluencers, influencerCampaigns, influencerPayouts } from '@/db/schema';
import { eq, sql, count, and, inArray, desc } from 'drizzle-orm';
// getPersonalizedRecommendations + RecommendationCard are imported by the
// CONSUMER dashboard branch below — keep them in. The brand path no longer
// calls them (3B fix: consumer-only function, was polluting brand surface).
import { getPersonalizedRecommendations } from '@/server/personalizationEngine';
import { RecommendationCard } from '@/components/recommendation-card';
import { BrandOnboardingBanner } from '@/components/BrandOnboardingBanner';
import { UpgradePromptCard } from '@/components/UpgradePromptCard';
import { InfluencerPayoutBanner } from '@/components/InfluencerPayoutBanner';
import { hasCompletedBrandOnboarding } from '@/db/repositories/brandProfileRepository';
import { getProfileByUserId as getInfluencerProfileByUserId } from '@/db/repositories/influencerProfileRepository';
import { hasPayoutAccount } from '@/db/repositories/payoutAccountRepository';
import { getRecommendedCampaigns as getRecommendedCampaignsService } from '@/server/campaignMarketplaceService';
import { formatCurrency } from '@/lib/currency';
import { NICHE_LABELS } from '@/lib/validation/influencer-onboarding';
import {
  Sparkles, ArrowRight, MessageSquare, TrendingUp, BarChart3, ExternalLink,
  Award, PenSquare, Trophy, ClipboardList,
  Megaphone, Wallet, User, FileText, ShieldCheck, IndianRupee, Store,
} from 'lucide-react';
// A9 — single source of truth for profile completeness. The
// verificationThresholdService also imports from here so the dashboard
// stat card and the verification gate can't drift.
import {
  type InfluencerProfileLite,
  type CompletenessFactor,
  COMPLETENESS_FACTORS,
  calcProfileCompleteness,
  getMissingProfileFactors,
} from '@/lib/influencer/profileCompleteness';

// ── Brand's product ids (scoping helper) ─────────────────────────
// Same pattern used in /dashboard/feedback/page.tsx. Falls back to []
// on error so the empty-state branch fires rather than 500-ing the
// whole dashboard.
async function getBrandProductIdsForDashboard(brandUserId: string): Promise<string[]> {
  try {
    const rows = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.ownerId, brandUserId));
    return rows.map((r) => r.id);
  } catch {
    return [];
  }
}

// Quick feedback totals — SCOPED by brand's product ids. Pre-fix this
// function had no WHERE clause and showed platform-wide feedback to
// brands. Audit ref: Pass 3 B-C2.
async function getDashboardFeedbackStats(brandProductIds: string[]) {
  if (brandProductIds.length === 0) {
    return { totalCount: 0, newCount: 0, positiveCount: 0, negativeCount: 0, avgRating: 0 };
  }
  try {
    const [row] = await db
      .select({
        totalCount: count(),
        newCount: sql<number>`COUNT(*) FILTER (WHERE ${feedback.status} = 'new')`,
        positiveCount: sql<number>`COUNT(*) FILTER (WHERE ${feedback.sentiment} = 'positive')`,
        negativeCount: sql<number>`COUNT(*) FILTER (WHERE ${feedback.sentiment} = 'negative')`,
        avgRating: sql<number>`COALESCE(AVG(${feedback.rating}), 0)`,
      })
      .from(feedback)
      .where(inArray(feedback.productId, brandProductIds));
    return row;
  } catch {
    return { totalCount: 0, newCount: 0, positiveCount: 0, negativeCount: 0, avgRating: 0 };
  }
}

// Consumer's own feedback stats
async function getConsumerFeedbackStats(email: string) {
  try {
    const [row] = await db
      .select({
        totalCount: count(),
        positiveCount: sql<number>`COUNT(*) FILTER (WHERE ${feedback.sentiment} = 'positive')`,
        negativeCount: sql<number>`COUNT(*) FILTER (WHERE ${feedback.sentiment} = 'negative')`,
        avgRating: sql<number>`COALESCE(AVG(${feedback.rating}), 0)`,
      })
      .from(feedback)
      .where(eq(feedback.userEmail, email));
    return row;
  } catch {
    return { totalCount: 0, positiveCount: 0, negativeCount: 0, avgRating: 0 };
  }
}

// Consumer's points balance
async function getConsumerPoints(userId: string) {
  try {
    const [row] = await db
      .select({
        totalPoints: userPoints.totalPoints,
        lifetimePoints: userPoints.lifetimePoints,
      })
      .from(userPoints)
      .where(eq(userPoints.userId, userId))
      .limit(1);
    return row ?? { totalPoints: 0, lifetimePoints: 0 };
  } catch {
    return { totalPoints: 0, lifetimePoints: 0 };
  }
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ upgrade?: string }>;
}) {
  const session = await auth();
  const userId = session?.user?.id;
  const userEmail = session?.user?.email || undefined;
  const role = session?.user?.role;

  // ER.2 — friendly upgrade prompt when a layout guard bounced the
  // user here from a wrong-role URL. The card is mounted ABOVE the
  // role-specific dashboard so it stays visible without rearranging
  // any per-role layout.
  //
  // Defensive: wrap the searchParams await in a try/catch so a malformed
  // or rejected Promise (e.g. transient Next.js RSC quirk) doesn't take
  // down the entire dashboard render. Falling back to `undefined`
  // simply means no upgrade card — the page still renders.
  let sp: { upgrade?: string } | undefined
  try {
    sp = searchParams ? await searchParams : undefined;
  } catch (err) {
    console.error('[DashboardPage] searchParams await failed:', err)
    sp = undefined
  }
  const upgrade =
    sp?.upgrade === 'influencer' || sp?.upgrade === 'brand' ? sp.upgrade : null;
  const promptCard = upgrade ? <UpgradePromptCard variant={upgrade} /> : null;

  if (role === 'brand') {
    return (
      <>
        {promptCard}
        <BrandDashboard userId={userId} />
      </>
    );
  }

  // 3.5D — pure influencer signups (role='influencer') get the
  // dedicated influencer dashboard. Dual-role consumer-with-isInfluencer
  // users (role='consumer') keep seeing ConsumerDashboard for now;
  // 3.5E adds the role-switcher so they can flip view.
  if (role === 'influencer') {
    return (
      <>
        {promptCard}
        <InfluencerDashboard userId={userId} userName={session?.user?.name ?? null} />
      </>
    );
  }

  return (
    <>
      {promptCard}
      <ConsumerDashboard userId={userId} userEmail={userEmail} />
    </>
  );
}

// ── Brand Dashboard ──────────────────────────────────────────────

async function BrandDashboard({ userId }: { userId?: string }) {
  // Resolve the brand's product ids first — feedback stats + the "no
  // products yet" empty-state branch both depend on it. Pre-fix this
  // function passed no scope to getDashboardFeedbackStats and showed
  // platform-wide totals; new code fans out from the product list.
  const brandProductIds = userId ? await getBrandProductIdsForDashboard(userId) : [];
  const hasProducts = brandProductIds.length > 0;

  const [feedbackStats, brandOnboardingDone] = await Promise.all([
    getDashboardFeedbackStats(brandProductIds),
    // Banner gating: shown when brand has NOT yet completed the wizard.
    // OnboardingGuard force-redirects new brands; existing brands fall
    // through to here and see the banner.
    userId ? hasCompletedBrandOnboarding(userId).catch(() => true) : Promise.resolve(true),
  ]);

  // NOTE: getPersonalizedRecommendations is a consumer-only function
  // (gated by personalization consent on the user_profiles row). It
  // was previously called for brands here — wasted query, returned
  // empty or threw, polluted the brand surface. Removed in 3B.

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-headline font-bold mb-2">
          Earn4Insights Dashboard
        </h1>
        <p className="text-muted-foreground">
          Overview of your products, feedback, and community activity.
        </p>
      </div>

      {/* Soft-prompt to complete brand onboarding (existing brands).
          New brands are force-redirected by OnboardingGuard. */}
      <BrandOnboardingBanner show={!brandOnboardingDone} />

      {/* Feedback Snapshot — or empty-state for brands with no
          products yet. We refuse to render zero numbers because they
          imply "no feedback on your products" which is misleading
          when the brand has no products at all. Stripe-style empty
          state instead. */}
      {hasProducts ? (
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
      ) : (
        <Card className="border-dashed">
          <CardContent className="py-10 flex flex-col items-center text-center gap-3">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <MessageSquare className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-foreground">
                You haven&apos;t added any products yet
              </p>
              <p className="text-sm text-muted-foreground mt-1 max-w-md">
                Add your first product to start collecting feedback,
                running surveys, and matching with influencers.
              </p>
            </div>
            <Button asChild size="sm">
              <Link href="/dashboard/launch">
                Add your first product
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

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

// ── Influencer Dashboard (3.5D) ──────────────────────────────────
//
// Shown to users with role='influencer' (pure influencer signups
// from 3.5B). Dual-role consumer-with-isInfluencer users keep
// seeing ConsumerDashboard until 3.5E lets them toggle view.

// A9 extraction — `InfluencerProfileLite`, `CompletenessFactor`,
// `COMPLETENESS_FACTORS`, `calcProfileCompleteness`,
// `getMissingProfileFactors` now live in
// `src/lib/influencer/profileCompleteness.ts` (imported above) so the
// dashboard + verification threshold service share one source of truth.

async function getInfluencerStats(userId: string) {
  // Active campaigns — accepted + active statuses both count as "ongoing".
  const [{ activeCount }] = await db
    .select({ activeCount: count() })
    .from(campaignInfluencers)
    .where(and(
      eq(campaignInfluencers.influencerId, userId),
      inArray(campaignInfluencers.status, ['accepted', 'active']),
    ))

  // Pending payouts — sum amount in paise where status is pending or
  // processing. India-first platform; we display INR-only on the card
  // and the user goes to /dashboard/influencer/earnings for the
  // multi-currency breakdown. Other currencies (USD / GBP / etc.)
  // surface there.
  const [pendingRow] = await db
    .select({
      total: sql<number>`COALESCE(SUM(${influencerPayouts.amount}), 0)::int`,
    })
    .from(influencerPayouts)
    .where(and(
      eq(influencerPayouts.recipientId, userId),
      inArray(influencerPayouts.status, ['pending', 'processing']),
      eq(influencerPayouts.currency, 'INR'),
    ))

  return {
    activeCount: Number(activeCount ?? 0),
    pendingPaiseInr: Number(pendingRow?.total ?? 0),
  }
}

async function getRecentInfluencerCampaigns(userId: string, limit = 5) {
  // Join campaign_influencers with influencer_campaigns to get
  // last-touched campaign cards on the home page.
  const rows = await db
    .select({
      campaign: influencerCampaigns,
      invitationStatus: campaignInfluencers.status,
      acceptedAt: campaignInfluencers.acceptedAt,
      updatedAt: campaignInfluencers.updatedAt,
    })
    .from(campaignInfluencers)
    .innerJoin(influencerCampaigns, eq(campaignInfluencers.campaignId, influencerCampaigns.id))
    .where(eq(campaignInfluencers.influencerId, userId))
    .orderBy(desc(campaignInfluencers.updatedAt))
    .limit(limit)
  return rows
}

async function InfluencerDashboard({ userId, userName }: { userId?: string; userName: string | null }) {
  // No userId means session was lost mid-render; render empty shell.
  if (!userId) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-headline font-bold">Loading…</h1>
      </div>
    )
  }

  const [profile, stats, recentCampaigns, recommendedRaw, hasAnyPayoutAccount] = await Promise.all([
    getInfluencerProfileByUserId(userId).catch(() => null),
    getInfluencerStats(userId).catch(() => ({ activeCount: 0, pendingPaiseInr: 0 })),
    getRecentInfluencerCampaigns(userId, 5).catch(() => []),
    getRecommendedCampaignsService(userId).catch(() => []),
    hasPayoutAccount(userId, 'influencer').catch(() => true),
  ])

  const completeness = calcProfileCompleteness(profile as InfluencerProfileLite | null)
  const missingFactors = getMissingProfileFactors(profile as InfluencerProfileLite | null)
    .filter(f => f.key !== 'portfolio') // hide the future-reserved factor from the breakdown — it's unreachable today
  const firstName = (userName?.split(' ')[0]) || 'there'
  const verificationStatus = profile?.verificationStatus ?? 'unverified'

  const verificationDisplay =
    verificationStatus === 'verified'
      ? { label: 'Verified',   cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' }
      : verificationStatus === 'pending'
      ? { label: 'Pending',    cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30' }
      : { label: 'Unverified', cls: 'bg-muted text-muted-foreground border-border' }

  // Take top 3 recommended campaigns for the home preview.
  const recommended = (recommendedRaw ?? []).slice(0, 3)

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="flex items-center gap-4">
        <div className="h-12 w-12 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center text-white shrink-0">
          <Sparkles className="h-6 w-6" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl sm:text-3xl font-headline font-bold">
            Welcome back, {firstName}! 🎯
          </h1>
          <p className="text-muted-foreground text-sm">
            Your campaigns, earnings, and reach — all in one place.
          </p>
        </div>
      </div>

      {/* A10 payout nudge — same component, also relevant for influencers */}
      <InfluencerPayoutBanner show={!hasAnyPayoutAccount} />

      {/* Stats overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-1">
              <Megaphone className="w-4 h-4 text-violet-500" />
              <p className="text-xs text-muted-foreground">Active campaigns</p>
            </div>
            <div className="text-2xl font-bold">{stats.activeCount}</div>
            <p className="text-xs text-muted-foreground">accepted or active</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-1">
              <IndianRupee className="w-4 h-4 text-emerald-500" />
              <p className="text-xs text-muted-foreground">Pending earnings</p>
            </div>
            <div className="text-2xl font-bold">
              {stats.pendingPaiseInr > 0 ? formatCurrency(stats.pendingPaiseInr, 'INR') : '—'}
            </div>
            <p className="text-xs text-muted-foreground">INR · queued payouts</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-1">
              <User className="w-4 h-4 text-pink-500" />
              <p className="text-xs text-muted-foreground">Profile completeness</p>
            </div>
            <div className="text-2xl font-bold">{completeness}%</div>
            <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-violet-500 to-pink-500 transition-all"
                style={{ width: `${Math.max(0, Math.min(100, completeness))}%` }}
              />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck className="w-4 h-4 text-blue-500" />
              <p className="text-xs text-muted-foreground">Verification</p>
            </div>
            <Badge variant="outline" className={`text-sm ${verificationDisplay.cls}`}>
              {verificationDisplay.label}
            </Badge>
            <p className="text-xs text-muted-foreground mt-2">
              {verificationStatus === 'verified'
                ? 'Brands see your verified badge'
                : 'Verification flow coming soon'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Boost your profile — shows breakdown of missing factors.
          Hidden when profile is at the practical max (today: 95% with
          portfolio reserved for the future). */}
      {missingFactors.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <User className="w-5 h-5 text-pink-500" />
            Boost your profile
          </h2>
          <Card>
            <CardContent className="pt-5 space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium">{completeness}% complete</p>
                  <p className="text-xs text-muted-foreground">
                    {100 - completeness}% to go
                  </p>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-violet-500 to-pink-500 transition-all"
                    style={{ width: `${Math.max(0, Math.min(100, completeness))}%` }}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">
                  Add these to your profile — each one improves how brands match you:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {missingFactors.map((f) => (
                    <Link
                      key={f.key}
                      href={f.href}
                      className="flex items-center justify-between gap-2 text-sm p-2.5 rounded-md border border-dashed border-border hover:border-pink-400 hover:bg-pink-500/5 transition-colors group"
                    >
                      <span className="truncate flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-pink-500 shrink-0" />
                        {f.label}
                      </span>
                      <span className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          +{f.weight}%
                        </Badge>
                        <ArrowRight className="h-3 w-3 text-muted-foreground group-hover:text-foreground transition-colors" />
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      {/* Quick actions */}
      <section>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-violet-500" />
          Quick actions
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Link
            href="/dashboard/influencer/marketplace"
            className="rounded-lg border border-border p-4 hover:border-violet-400 hover:bg-violet-500/5 transition-colors group"
          >
            <Store className="h-5 w-5 text-violet-500 mb-2" />
            <p className="text-sm font-medium">Browse marketplace</p>
            <p className="text-xs text-muted-foreground">Apply to campaigns</p>
            <ArrowRight className="h-3.5 w-3.5 mt-2 text-muted-foreground group-hover:text-foreground transition-colors" />
          </Link>
          <Link
            href="/dashboard/influencer/content"
            className="rounded-lg border border-border p-4 hover:border-pink-400 hover:bg-pink-500/5 transition-colors group"
          >
            <FileText className="h-5 w-5 text-pink-500 mb-2" />
            <p className="text-sm font-medium">My content</p>
            <p className="text-xs text-muted-foreground">Submissions &amp; drafts</p>
            <ArrowRight className="h-3.5 w-3.5 mt-2 text-muted-foreground group-hover:text-foreground transition-colors" />
          </Link>
          <Link
            href="/dashboard/influencer/earnings"
            className="rounded-lg border border-border p-4 hover:border-emerald-400 hover:bg-emerald-500/5 transition-colors group"
          >
            <Wallet className="h-5 w-5 text-emerald-500 mb-2" />
            <p className="text-sm font-medium">Earnings</p>
            <p className="text-xs text-muted-foreground">Multi-currency totals</p>
            <ArrowRight className="h-3.5 w-3.5 mt-2 text-muted-foreground group-hover:text-foreground transition-colors" />
          </Link>
          <Link
            href="/dashboard/influencer/profile"
            className="rounded-lg border border-border p-4 hover:border-blue-400 hover:bg-blue-500/5 transition-colors group"
          >
            <User className="h-5 w-5 text-blue-500 mb-2" />
            <p className="text-sm font-medium">Update profile</p>
            <p className="text-xs text-muted-foreground">Boost discoverability</p>
            <ArrowRight className="h-3.5 w-3.5 mt-2 text-muted-foreground group-hover:text-foreground transition-colors" />
          </Link>
        </div>
      </section>

      {/* Recommended campaigns */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-violet-500" />
            Recommended for you
          </h2>
          <Button asChild variant="ghost" size="sm">
            <Link href="/dashboard/influencer/marketplace" className="flex items-center gap-1 text-sm">
              See all <ArrowRight className="w-3 h-3" />
            </Link>
          </Button>
        </div>
        {recommended.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-10 text-center gap-2">
              <Store className="h-7 w-7 text-muted-foreground" />
              <p className="text-sm font-medium">No recommendations yet</p>
              <p className="text-xs text-muted-foreground max-w-md">
                {(profile?.niche?.length ?? 0) === 0
                  ? 'Add niches to your profile so we can match you to relevant campaigns.'
                  : 'New campaigns matching your niches will appear here as brands publish them.'}
              </p>
              <Button asChild size="sm" className="mt-1">
                <Link href="/dashboard/influencer/marketplace">Browse all campaigns</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {recommended.map((c: any) => (
              <Card key={c.id} className="hover:border-primary/30 transition-colors">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold line-clamp-1">{c.title}</CardTitle>
                  <p className="text-xs text-muted-foreground line-clamp-2 min-h-[2.5em]">
                    {c.brief ?? c.brandName ?? 'Brand campaign'}
                  </p>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <IndianRupee className="h-3 w-3" />
                      {(c.budgetTotal / 100).toLocaleString()} {c.budgetCurrency}
                    </span>
                    {c.applicationDeadline && (
                      <span>by {new Date(c.applicationDeadline).toLocaleDateString()}</span>
                    )}
                  </div>
                  <Button asChild size="sm" variant="outline" className="w-full">
                    <Link href="/dashboard/influencer/marketplace">View &amp; apply</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Recent activity */}
      <section>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-pink-500" />
          Recent activity
        </h2>
        {recentCampaigns.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-8 text-center gap-2">
              <Megaphone className="h-6 w-6 text-muted-foreground" />
              <p className="text-sm font-medium">No campaign activity yet</p>
              <p className="text-xs text-muted-foreground">
                Apply to a campaign or accept an invitation to see updates here.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <ul className="divide-y divide-border">
                {recentCampaigns.map((row) => {
                  const c = row.campaign
                  const status = row.invitationStatus
                  const niches = Array.isArray(c.targetGeography) ? c.targetGeography : []
                  return (
                    <li key={`${c.id}`} className="flex items-center gap-3 p-3 hover:bg-muted/40 transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium truncate">{c.title}</p>
                          <Badge variant="outline" className="text-[10px]">{status}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {formatCurrency(c.budgetTotal, c.budgetCurrency)}
                          {niches.length > 0 && (
                            <> · {niches.slice(0, 2).join(', ')}</>
                          )}
                        </p>
                      </div>
                      <Link
                        href={`/dashboard/influencer/campaigns/${c.id}`}
                        className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                      >
                        Open <ArrowRight className="h-3 w-3" />
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </CardContent>
          </Card>
        )}
      </section>

      {/* Niche summary footer (small) */}
      {profile && (profile.niche?.length ?? 0) > 0 && (
        <section>
          <p className="text-xs text-muted-foreground mb-1.5">Your niches</p>
          <div className="flex flex-wrap gap-1.5">
            {(profile.niche ?? []).map((n: string) => (
              <Badge key={n} variant="outline" className="text-xs">
                {NICHE_LABELS[n as keyof typeof NICHE_LABELS] ?? n}
              </Badge>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

// ── Consumer Dashboard ──────────────────────────────────────────

async function ConsumerDashboard({ userId, userEmail }: { userId?: string; userEmail?: string }) {
  const [myStats, points, recommendations, influencerProfile, hasAnyPayoutAccount] = await Promise.all([
    userEmail ? getConsumerFeedbackStats(userEmail) : Promise.resolve({ totalCount: 0, positiveCount: 0, negativeCount: 0, avgRating: 0 }),
    userId ? getConsumerPoints(userId) : Promise.resolve({ totalPoints: 0, lifetimePoints: 0 }),
    userId ? getPersonalizedRecommendations(userId, 3).catch(() => []) : Promise.resolve([]),
    // A10 L1 — banner is gated on (has influencer profile) AND (no payout account).
    // Catch on both so a single failure here can't sink the whole dashboard.
    userId ? getInfluencerProfileByUserId(userId).catch(() => null) : Promise.resolve(null),
    userId ? hasPayoutAccount(userId, 'influencer').catch(() => true) : Promise.resolve(true),
  ]);
  // Show the payout banner only when the user has registered as an
  // influencer (so payouts will matter) AND hasn't added any payout
  // account yet. We use the "ANY currency" form here (cheap nudge);
  // the hard L3/L4 guards check currency-specific.
  const showInfluencerPayoutBanner = !!influencerProfile && !hasAnyPayoutAccount;

  let topRecommendations: Array<{
    productId: string;
    score: number;
    reasons: string[];
    product?: any;
  }> = [];

  if (recommendations.length > 0) {
    try {
      const allProducts = await db.select().from(products);
      const productMap = new Map(allProducts.map(p => [p.id, p]));
      topRecommendations = recommendations
        .map(rec => ({ ...rec, product: productMap.get(rec.productId) }))
        .filter(rec => rec.product);
    } catch (error) {
      console.error('[Dashboard] Error fetching products for recommendations:', error);
    }
  }

  const cashValue = (points.totalPoints / 100).toFixed(2);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-headline font-bold mb-2">
          Welcome back! 👋
        </h1>
        <p className="text-muted-foreground">
          Your hub for earning rewards, sharing feedback, and discovering products.
        </p>
      </div>

      {/* A10 L1 — payout nudge for registered influencers without an account */}
      <InfluencerPayoutBanner show={showInfluencerPayoutBanner} />

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-1">
              <Award className="w-4 h-4 text-yellow-500" />
              <p className="text-xs text-muted-foreground">Points Balance</p>
            </div>
            <div className="text-2xl font-bold">{points.totalPoints.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">≈ ${cashValue}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-1">
              <Trophy className="w-4 h-4 text-purple-500" />
              <p className="text-xs text-muted-foreground">Lifetime Earned</p>
            </div>
            <div className="text-2xl font-bold">{points.lifetimePoints.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">all-time points</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-1">
              <MessageSquare className="w-4 h-4 text-blue-500" />
              <p className="text-xs text-muted-foreground">Feedback Given</p>
            </div>
            <div className="text-2xl font-bold">{myStats?.totalCount ?? 0}</div>
            <p className="text-xs text-muted-foreground">
              {Number(myStats?.avgRating) > 0
                ? `${Number(myStats.avgRating).toFixed(1)} avg rating`
                : 'no ratings yet'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-green-500" />
              <p className="text-xs text-muted-foreground">Impact</p>
            </div>
            <div className="flex items-center gap-1 text-lg">
              <span className="text-green-600 font-bold">{myStats?.positiveCount ?? 0}</span>
              <span className="text-muted-foreground text-sm">/</span>
              <span className="text-red-600 font-bold">{myStats?.negativeCount ?? 0}</span>
            </div>
            <p className="text-xs text-muted-foreground">positive / negative</p>
          </CardContent>
        </Card>
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

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PenSquare className="w-4 h-4" />
              Submit Feedback
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Share your opinion on products and earn 25 points per review.
            </p>
            <Button asChild size="sm">
              <Link href="/dashboard/submit-feedback">Give feedback</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="w-4 h-4" />
              My Feedback
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">
              View your feedback history, ratings, and sentiment analysis.
            </p>
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/my-feedback">View history</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="w-4 h-4" />
              Rewards
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Redeem your points for rewards and track your earnings.
            </p>
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/rewards">View rewards</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="w-4 h-4" />
              Weekly Top 10
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">
              See this week&apos;s highest-rated products voted by consumers.
            </p>
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/rankings">View rankings</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
