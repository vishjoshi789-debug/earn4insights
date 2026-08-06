/**
 * ONE canonical statement of who sees submitted feedback.
 *
 * Three submission surfaces previously said three different things:
 *   • /dashboard/submit-feedback  — silent on visibility entirely
 *   • /submit-feedback            — "may be shared with the product's brand"
 *   • the /public-products mock   — "Help other users discover quality products"
 *
 * The last one implied a public review site; the first told the consumer
 * nothing at all. Neither matched what the product actually does. This module
 * is the single source of truth so they cannot drift again — import it, don't
 * retype it.
 *
 * ── ACCURACY, checked against the code as of 2026-08-06 ──────────────────
 * Every clause below is true of the system after the public-summary scope fix:
 *
 *   "goes to this product's brand"
 *       api/feedback/submit writes user_id/user_name/user_email; the owning
 *       brand reads it via ownership-gated routes.
 *   "they can see what you wrote, your name, and anything you record"
 *       RecentFeedback + the feedback page render exactly these, owner-gated.
 *   "other people see only anonymised aggregates — overall sentiment and
 *    common themes"
 *       generatePublicSummary('public') returns theme names + counts and
 *       strips every verbatim field.
 *   "never your words or your identity"
 *       example/recentHighlights are null/[] for non-owners; MIN_COHORT_SIZE
 *       suppresses small cohorts.
 *
 * If any of those gates change, THIS TEXT BECOMES A FALSE CLAIM. Under the §5
 * claims policy an unqualified statement in the submission flow is
 * contractual — the consumer relies on it when deciding what to write.
 */

/** Headline for the disclosure panel. */
export const FEEDBACK_VISIBILITY_TITLE = 'Who sees your feedback'

/**
 * Body copy. Covers TEXT feedback as well as media — text previously had no
 * disclosure of any kind, despite being the most common submission type.
 */
export const FEEDBACK_VISIBILITY_BODY =
  "Your feedback goes to this product's brand. They can see what you wrote, " +
  'your name, and any recordings or photos you attach. ' +
  'Everyone else on Earn4Insights sees only anonymised aggregates — overall ' +
  'sentiment and common themes — never your words or your identity.'

/**
 * One-line variant for tight footers where the full panel doesn't fit.
 * Same meaning, no softening: if it can't be said accurately, it isn't said.
 */
export const FEEDBACK_VISIBILITY_SHORT =
  "Your feedback goes to this product's brand, including your name and any " +
  'recordings. Others see only anonymised aggregates — never your words or identity.'
