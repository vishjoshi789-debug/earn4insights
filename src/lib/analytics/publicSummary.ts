import 'server-only'

import { db } from '@/db'
import { extractedThemes, feedback, surveyResponses } from '@/db/schema'
import { MIN_COHORT_SIZE } from '@/db/repositories/competitiveIntelligenceRepository'
import { eq, desc, gte } from 'drizzle-orm'

// ── Types ─────────────────────────────────────────────────────────

/**
 * Who is asking. This is NOT cosmetic — it decides whether verbatim consumer
 * words leave the owning brand.
 *
 *   'owner'  — the brand that owns the product, or an admin. Sees quotes.
 *   'public' — any other logged-in user: a competing brand, a consumer, an
 *              influencer. Sees aggregates ONLY, never verbatim text.
 *
 * Defaults to 'public' at every layer, so a caller that forgets to pass a
 * scope leaks nothing.
 */
export type SummaryViewerScope = 'owner' | 'public'

export type PublicSummaryInsight = {
  label: string
  theme: string
  mentionCount: number
  sentiment: string
  /**
   * A verbatim excerpt of one consumer's feedback. NULL for every non-owner —
   * this field is the whole reason viewer scope exists.
   */
  example: string | null
}

export type PublicProductSummary = {
  productId: string
  topPraise: PublicSummaryInsight | null
  topConcern: PublicSummaryInsight | null
  emergingIssue: PublicSummaryInsight | null
  overallSentiment: {
    positive: number
    negative: number
    neutral: number
    score: number // -1 to 1
  }
  recentHighlights: string[]
  totalFeedbackCount: number
  lastUpdated: string
  /** Echoed so the UI can label what it is showing and why. */
  viewerScope: SummaryViewerScope
  /** True when aggregates were withheld because the cohort is under the floor. */
  suppressedForCohortSize: boolean
}

// ── Main function ─────────────────────────────────────────────────

/**
 * Generate a product feedback summary, scoped to who is asking.
 *
 * ── WHY THIS IS SCOPED (2026-08-06) ──────────────────────────────────────
 * This function used to return the same payload to everybody, and its route
 * had no auth at all. That published REAL consumer complaints, verbatim, to
 * any logged-in user — including competing brands — for any product id. Live
 * examples that were being served:
 *
 *   "Earn4Insights downtime is getting frustrating. Third time this month."
 *   "StartupsGurukul has been having issues lately. Support response time is slow."
 *   "Had a bad experience with StartupsGurukul integration. Documentation is lacking."
 *
 * That broke three explicit sentences in the published privacy policy: that
 * brands receive "aggregated and anonymized" insights, that aggregates appear
 * only "above a minimum group size", and that feedback content is visible only
 * to the brand the feedback was submitted to.
 *
 * ── THE SPLIT ────────────────────────────────────────────────────────────
 * Owner/admin gets everything, including quotes — the consumer submitted to
 * that brand, so the brand reading their words is the interaction working.
 *
 * Everyone else gets the aggregate shape and NO verbatim text:
 *   • sentiment counts + score      ✅  (a number about many people)
 *   • theme NAME + mention count    ✅  ("Performance", 15 mentions)
 *   • totalFeedbackCount            ✅
 *   • example quote                 ❌  always null
 *   • recentHighlights              ❌  always empty
 *
 * A theme name is an abstraction produced from many rows; a quote is one
 * identifiable person's words. That is the line.
 *
 * ── THE COHORT FLOOR ─────────────────────────────────────────────────────
 * For non-owners, MIN_COHORT_SIZE (5) applies twice:
 *   1. Whole summary suppressed when total feedback < 5. Otherwise "1 negative"
 *      on a 1-row product is a sentiment reading of one identifiable person.
 *   2. Per theme — a theme under the floor is dropped, so "Documentation
 *      problems (2 mentions)" can't single out a small group.
 * Owners are not floored: it is their own product's feedback, submitted to them.
 */
export async function generatePublicSummary(
  productId: string,
  viewerScope: SummaryViewerScope = 'public'
): Promise<PublicProductSummary> {
  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const isOwner = viewerScope === 'owner'

  // 1. Get extracted themes for this product
  const themes = await db
    .select()
    .from(extractedThemes)
    .where(eq(extractedThemes.productId, productId))
    .orderBy(desc(extractedThemes.mentionCount))
    .limit(20)

  // 2. Get recent feedback for sentiment counts
  const recentFeedback = await db
    .select({
      sentiment: feedback.sentiment,
      feedbackText: feedback.feedbackText,
      createdAt: feedback.createdAt,
    })
    .from(feedback)
    .where(eq(feedback.productId, productId))
    .orderBy(desc(feedback.createdAt))
    .limit(200)

  // 3. Count all feedback + surveys
  const allFeedback = await db
    .select({ id: feedback.id })
    .from(feedback)
    .where(eq(feedback.productId, productId))

  const allSurveys = await db
    .select({ id: surveyResponses.id })
    .from(surveyResponses)
    .where(eq(surveyResponses.productId, productId))

  const totalFeedbackCount = allFeedback.length + allSurveys.length

  // 4. Overall sentiment from feedback
  const positive = recentFeedback.filter(f => f.sentiment === 'positive').length
  const negative = recentFeedback.filter(f => f.sentiment === 'negative').length
  const neutral = recentFeedback.filter(f => f.sentiment === 'neutral' || !f.sentiment).length
  const total = positive + negative + neutral
  const sentimentScore = total > 0 ? (positive - negative) / total : 0

  // ── PRIVACY FLOOR — non-owners only ───────────────────────────────────
  // Below the floor even a pure count identifies: on a product with two
  // pieces of feedback, "1 negative" plus a timestamp is one person. Return
  // the count only (it is on the public catalog anyway) and nothing else.
  if (!isOwner && totalFeedbackCount < MIN_COHORT_SIZE) {
    return {
      productId,
      topPraise: null,
      topConcern: null,
      emergingIssue: null,
      overallSentiment: { positive: 0, negative: 0, neutral: 0, score: 0 },
      recentHighlights: [],
      totalFeedbackCount,
      lastUpdated: now.toISOString(),
      viewerScope,
      suppressedForCohortSize: true,
    }
  }

  // Per-theme floor for non-owners — a 2-mention theme is a small enough
  // group to be re-identifiable by the brand's own customers.
  const visibleThemes = isOwner
    ? themes
    : themes.filter(t => t.mentionCount >= MIN_COHORT_SIZE)

  // 5. Identify top praise (highest mention positive theme)
  const positiveThemes = visibleThemes.filter(t => t.sentiment === 'positive')
  const topPraise = positiveThemes.length > 0
    ? buildInsight('🌟 Top Praise', positiveThemes[0], isOwner)
    : null

  // 6. Identify top concern (highest mention negative theme)
  const negativeThemes = visibleThemes.filter(t => t.sentiment === 'negative')
  const topConcern = negativeThemes.length > 0
    ? buildInsight('⚠️ Top Concern', negativeThemes[0], isOwner)
    : null

  // 7. Emerging issue: look for themes extracted recently with growing mentions
  // or themes with 'mixed' sentiment (indicates unresolved)
  const mixedThemes = visibleThemes.filter(t => t.sentiment === 'mixed')
  const recentThemes = visibleThemes.filter(t => {
    if (!t.extractedAt) return false
    return new Date(t.extractedAt) >= sevenDaysAgo
  })

  const emergingCandidate = recentThemes.find(t => t.sentiment === 'negative' || t.sentiment === 'mixed')
    || mixedThemes[0]
    || null

  const emergingIssue = emergingCandidate
    ? buildInsight('🔔 Emerging Issue', emergingCandidate, isOwner)
    : null

  // 8. Recent highlights — short positive feedback excerpts.
  //    VERBATIM CONSUMER TEXT: owner/admin only, never anyone else.
  const recentHighlights = isOwner
    ? recentFeedback
        .filter(f => f.sentiment === 'positive' && f.feedbackText)
        .slice(0, 3)
        .map(f => f.feedbackText!.slice(0, 100))
    : []

  return {
    productId,
    topPraise,
    topConcern,
    emergingIssue,
    overallSentiment: { positive, negative, neutral, score: sentimentScore },
    recentHighlights,
    totalFeedbackCount,
    lastUpdated: now.toISOString(),
    viewerScope,
    suppressedForCohortSize: false,
  }
}

// ── Helpers ───────────────────────────────────────────────────────

function buildInsight(
  label: string,
  theme: {
    theme: string
    mentionCount: number
    sentiment: string | null
    examples: unknown
  },
  includeExample: boolean
): PublicSummaryInsight {
  const examples = theme.examples as string[] | null
  return {
    label,
    theme: theme.theme,
    mentionCount: theme.mentionCount,
    sentiment: theme.sentiment || 'neutral',
    // The verbatim quote. Gated on the caller's scope, not on truthiness —
    // `includeExample` is false for every non-owner.
    example: includeExample && examples && examples.length > 0
      ? examples[0].slice(0, 120)
      : null,
  }
}
