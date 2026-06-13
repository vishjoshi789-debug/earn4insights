/**
 * A9 — Influencer verification threshold constants.
 *
 * Single source of truth for every cutoff used by the 3-tier auto-approval
 * system (`verificationThresholdService.evaluateVerificationRequest`).
 * Changing a number here is the only edit needed to retune the gate —
 * the service reads these directly, no inline magic numbers.
 *
 * Tier model:
 *   Tier 1 (auto-approve) — ALL 8 basic checks pass AND follower bar met.
 *   Tier 2 (manual review) — basic checks pass but follower count or
 *                            account age is borderline, OR self-reported
 *                            followers exceed the trust cap, OR user
 *                            explicitly requested review.
 *   Tier 3 (auto-reject)  — one or more hard-floor checks fail (e.g. no
 *                            email verification, no bio, no photo).
 */

export const VERIFICATION_THRESHOLDS = {
  // ── Tier 1 basic-check minimums ─────────────────────────────────
  MIN_BIO_LENGTH: 50,
  MIN_NICHES: 2,
  MIN_SOCIAL_HANDLES: 1,
  MIN_ACCOUNT_AGE_DAYS: 7,
  MIN_PROFILE_COMPLETENESS: 80,

  // ── Follower thresholds (sum across all connected platforms) ─────
  /** Auto-approve if total followers ≥ this AND ≤ MAX_AUTO_APPROVE_FOLLOWERS */
  AUTO_APPROVE_FOLLOWERS: 1_000,
  /** Manual review if 500 ≤ followers < AUTO_APPROVE_FOLLOWERS */
  MANUAL_REVIEW_FOLLOWERS_MIN: 500,
  /**
   * Self-reported followers above this trip manual review even if all
   * other checks pass — fraud guard. OAuth-verified handles bypass this
   * (verificationMethod === 'api_verified' on the social_stats row).
   */
  MAX_AUTO_APPROVE_FOLLOWERS: 100_000,

  // ── Tier 3 hard-floor rejections ────────────────────────────────
  REJECTION_BIO_LENGTH: 20,
  REJECTION_ACCOUNT_AGE_DAYS: 1,
  REJECTION_PROFILE_COMPLETENESS: 50,

  // ── Cooldown after rejection ────────────────────────────────────
  /** Days the user must wait after a rejection before re-applying. */
  COOLDOWN_AFTER_REJECTION_DAYS: 30,
} as const

export type VerificationThresholdKey = keyof typeof VERIFICATION_THRESHOLDS
