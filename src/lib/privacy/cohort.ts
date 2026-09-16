/**
 * THE ONE COHORT FLOOR. Every aggregate a brand can see is suppressed below it.
 *
 * ⚠️ ONE DEFINITION. This constant used to be declared in THREE places
 * (competitiveIntelligenceRepository, the icp-audience route, and
 * influencerEarningsService) — three copies of the same number, one drift away
 * from disagreeing. A fourth was about to be written for the watchlist gate.
 * Consolidated here; the CI repository re-exports it so its existing importers
 * are untouched. Import from HERE for anything new.
 *
 * ── THE CONTRACT ─────────────────────────────────────────────────
 *
 * A helper that hits the floor returns `null` (or a `suppressed` variant),
 * NEVER 0. Zero is a claim — "nobody" — and a false one when the true number
 * is 1 to 4. Callers must handle the suppressed case explicitly; a UI that
 * renders "0 people watching" over a suppressed count has told the brand
 * something untrue.
 *
 * ── WHY 5 ────────────────────────────────────────────────────────
 *
 * Small enough to be reachable, large enough that a bucket cannot be a single
 * identifiable person once any second attribute is attached (a count of 3 on
 * a product with 9 consumers is very nearly a name).
 *
 * ⚠️ DO NOT LOWER THE FLOOR FOR ONE SIGNAL "so it demos sooner". A different
 * floor for the watchlist, or the ICP audience, or any one path is the
 * exception that becomes the rule. If 5 is wrong it is wrong everywhere, and
 * the change is one line here. Founder decision, 2026-09-16.
 */
export const MIN_COHORT_SIZE = 5
