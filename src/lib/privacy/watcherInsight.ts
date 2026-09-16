/**
 * Watcher insight — what a brand may learn about who is watching its product.
 *
 * ══════════════════════════════════════════════════════════════════
 * ⚠️ READ THIS BEFORE CHANGING WATCHER_INSIGHT_TIER. THE STEP FROM 'trend'
 * TO 'demographic' IS A LEGAL DECISION, NOT A PRODUCT ONE.
 * ══════════════════════════════════════════════════════════════════
 *
 * This is a BUILD-TIME CONSTANT on purpose — the same pattern as
 * RAZORPAYX_ENABLED. Not an env var: Vercel env edits do not pass through git,
 * so the decision would be invisible to review and preview/production could
 * drift. Not DB config: a runtime edit nobody reviews. A constant means
 * changing the tier is a commit with a diff on main.
 *
 * ── THE TIERS, LEAST TO MOST REVEALING ───────────────────────────
 *
 *   none         nothing, ever. The gate always suppresses.
 *
 *   count        "12 people are watching this."  ← SHIPS TODAY
 *                Reads product_watchlist only. A watch is the consumer's own
 *                act on the brand's own product; a count of those acts, above
 *                the cohort floor, is service data about the product. Under
 *                the most conservative reading it needs no new consent.
 *
 *   trend        count, bucketed by created_at: "up from 8 last week".
 *                Still a count of an act. Same basis as 'count'.
 *
 *   ─────────────── THE CONSENT BOUNDARY IS HERE ───────────────────
 *
 *   demographic  "12 watching · 60% aged 25–34 · 70% Bangalore".
 *                Reads product_watchlist JOINED to user_profiles.demographics.
 *                This is no longer a count of an act — it is a PORTRAIT OF THE
 *                PEOPLE behind it, inferred from profile data the consumer gave
 *                us for a different purpose. Plausibly needs `demographic`
 *                consent per watcher, only consenting watchers may enter the
 *                buckets, and the cohort floor applies PER BUCKET, not just to
 *                the total. NOT BUILT. Pending legal advice.
 *
 *   identified   "Priya S. is watching."
 *                Reads product_watchlist JOINED to users. Disclosure of an
 *                identified individual's intent to a third party. No existing
 *                consent category covers this — `demographic` and `behavioral`
 *                are about US processing, not THEM receiving. Would need a new
 *                explicit, per-purpose category naming the brand as recipient,
 *                asked at the moment of watching (the only point with any
 *                context), default off, never re-asked of decliners.
 *                NOT BUILT. Pending legal advice.
 *
 * ── WHY THE BOUNDARY IS WHERE IT IS ──────────────────────────────
 *
 * The same lesson as 560ce5a (intent inference): "the brand can already see
 * the product" does not establish a lawful purpose for inferring who is
 * interested in it. Counting watchers describes the product. Profiling
 * watchers describes people. The first is the brand's business; the second is
 * the consumer's, and they have not been asked.
 *
 * Whoever reads this because they want 'demographic': the code path is a
 * config change plus a consent prompt, by design. The prompt is the part that
 * is not optional.
 *
 * ── TWO KNOBS, DELIBERATELY SEPARATE ─────────────────────────────
 *
 * TIER says WHAT SHAPE a brand may see. MIN_COHORT_SIZE (lib/privacy/cohort)
 * says AT WHAT SIZE. Legal sets the tier; the floor is already policy and is
 * shared with every other aggregate on the platform. Do not fold one into the
 * other.
 */

export type WatcherInsightTier = 'none' | 'count' | 'trend' | 'demographic' | 'identified'

/**
 * The tier in force. Change = commit.
 *
 * 'count' is the most conservative tier that shows a brand anything: service
 * data, aggregate only, above the cohort floor, no attribution.
 */
export const WATCHER_INSIGHT_TIER: WatcherInsightTier = 'count'

/**
 * What the gate returns. A discriminated union so a caller MUST branch on
 * `tier` and cannot accidentally read a number that is not there.
 *
 * ⚠️ `suppressed` carries a `reason` for logging and tests only. Do not render
 * the reason to a brand — "hidden for privacy" is itself a disclosure that
 * watchers exist.
 */
export type WatcherInsight =
  | { tier: 'suppressed'; reason: 'not_owner' | 'tier_none' | 'below_floor' }
  | { tier: 'count'; watchers: number }
  // Shapes for tiers that are designed but NOT BUILT. Declared so that the
  // union is complete and a future implementation has a contract to meet;
  // the gate throws if the config selects one of these before it exists.
  | { tier: 'trend'; watchers: number; previousWatchers: number }
  | { tier: 'demographic'; watchers: number; buckets: Record<string, number | null> }
  | { tier: 'identified'; watchers: Array<{ userId: string; displayName: string }> }
