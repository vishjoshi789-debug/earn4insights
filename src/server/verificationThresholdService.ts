import 'server-only'

import { eq, sql } from 'drizzle-orm'

import { db } from '@/db'
import { users, influencerProfiles, influencerSocialStats } from '@/db/schema'
import { VERIFICATION_THRESHOLDS } from '@/lib/config/verificationThresholds'
import {
  type InfluencerProfileLite,
  calcProfileCompleteness,
} from '@/lib/influencer/profileCompleteness'

/**
 * A9 — 3-tier influencer-verification threshold evaluator.
 *
 * Combines 8 checks against the constants in
 * `src/lib/config/verificationThresholds.ts` and emits a tier + auto-
 * decision recommendation. Pure read-only — does NOT write any state;
 * the route layer persists the result onto the request row and flips
 * `influencer_profiles.verification_status` based on `autoDecision`.
 *
 * Tier model:
 *   Tier 1 (auto-approve) — ALL 8 basic checks pass AND total followers
 *                           in [AUTO_APPROVE_FOLLOWERS, MAX_AUTO_APPROVE_FOLLOWERS].
 *   Tier 2 (manual review) — basic checks pass but borderline followers
 *                            or account age, OR self-reported followers
 *                            above the trust cap (fraud guard).
 *   Tier 3 (auto-reject)  — one or more HARD-FLOOR checks fail. Never
 *                            promotes to review; the user must fix the
 *                            specific failed items and re-submit.
 *
 * Follower aggregation: sum of `influencer_social_stats.follower_count`
 * across every platform the influencer has connected. OAuth-verified
 * stats (`verification_method = 'api_verified'`) bypass the
 * MAX_AUTO_APPROVE_FOLLOWERS fraud cap — those numbers came from the
 * platform's own API.
 */

type Tier = 1 | 2 | 3
type AutoDecision = 'approve' | 'reject' | 'review'

type CheckResult = {
  passed: boolean
  value?: unknown
  threshold?: unknown
}

export type VerificationEvaluation = {
  tier: Tier
  autoDecision: AutoDecision
  checks: Record<string, CheckResult>
  failedChecks: string[]
  totalFollowers: number
  hasApiVerifiedHandle: boolean
  reason: string
}

const TH = VERIFICATION_THRESHOLDS

/**
 * Evaluate a user's eligibility for verified-influencer status.
 *
 * Returns a structured decision the route layer persists onto the
 * request row. Throws only on DB failure or missing prerequisite rows
 * (no influencer profile, no users row) — callers should catch and
 * return a 4xx with a helpful message.
 */
export async function evaluateVerificationRequest(
  userId: string,
): Promise<VerificationEvaluation> {
  // ── 1. Load user + profile + aggregated social stats ────────────
  const [user] = await db
    .select({
      id: users.id,
      createdAt: users.createdAt,
      emailVerifiedAt: users.emailVerifiedAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!user) {
    throw new Error('User not found')
  }

  const [profile] = await db
    .select()
    .from(influencerProfiles)
    .where(eq(influencerProfiles.userId, userId))
    .limit(1)

  if (!profile) {
    throw new Error('Influencer profile not found — complete onboarding first')
  }

  // Sum followers across platforms; also flag whether any handle is
  // OAuth-verified (bypasses the fraud cap for high self-reports).
  const [followerRow] = await db
    .select({
      total: sql<number>`COALESCE(SUM(${influencerSocialStats.followerCount}), 0)::int`,
      apiVerifiedCount: sql<number>`COUNT(*) FILTER (WHERE ${influencerSocialStats.verificationMethod} = 'api_verified')::int`,
    })
    .from(influencerSocialStats)
    .where(eq(influencerSocialStats.influencerId, userId))

  const totalFollowers = Number(followerRow?.total ?? 0)
  const hasApiVerifiedHandle = Number(followerRow?.apiVerifiedCount ?? 0) > 0

  // ── 2. Profile shape for completeness scorer ────────────────────
  const profileLite: InfluencerProfileLite = {
    displayName: profile.displayName,
    bio: profile.bio,
    niche: profile.niche,
    location: profile.location,
    profileImageUrl: profile.profileImageUrl,
    baseRate: profile.baseRate,
    currency: profile.currency,
    contentTypes: profile.contentTypes,
    audienceDemographics: profile.audienceDemographics as Record<string, unknown> | null,
    verificationStatus: profile.verificationStatus,
    instagramHandle: profile.instagramHandle,
    youtubeHandle: profile.youtubeHandle,
    twitterHandle: profile.twitterHandle,
    linkedinHandle: profile.linkedinHandle,
    tiktokHandle: profile.tiktokHandle,
  }
  const completeness = calcProfileCompleteness(profileLite)

  // ── 3. Derived facts ────────────────────────────────────────────
  const now = Date.now()
  const accountAgeDays = (now - new Date(user.createdAt).getTime()) / 86_400_000
  const bioLength = profile.bio?.trim().length ?? 0
  const nicheCount = profile.niche?.length ?? 0
  const socialHandleCount = [
    profile.instagramHandle,
    profile.youtubeHandle,
    profile.twitterHandle,
    profile.linkedinHandle,
    profile.tiktokHandle,
  ].filter(Boolean).length

  // ── 4. Build all 8 checks (in spec order) ───────────────────────
  const checks: Record<string, CheckResult> = {
    emailVerified: {
      passed: user.emailVerifiedAt !== null,
      value: user.emailVerifiedAt !== null,
      threshold: true,
    },
    profilePhoto: {
      passed: !!profile.profileImageUrl,
      value: !!profile.profileImageUrl,
      threshold: true,
    },
    bioLength: {
      passed: bioLength >= TH.MIN_BIO_LENGTH,
      value: bioLength,
      threshold: TH.MIN_BIO_LENGTH,
    },
    niches: {
      passed: nicheCount >= TH.MIN_NICHES,
      value: nicheCount,
      threshold: TH.MIN_NICHES,
    },
    socialHandles: {
      passed: socialHandleCount >= TH.MIN_SOCIAL_HANDLES,
      value: socialHandleCount,
      threshold: TH.MIN_SOCIAL_HANDLES,
    },
    accountAge: {
      passed: accountAgeDays >= TH.MIN_ACCOUNT_AGE_DAYS,
      value: Math.floor(accountAgeDays * 10) / 10, // 1 decimal place
      threshold: TH.MIN_ACCOUNT_AGE_DAYS,
    },
    onboardingComplete: {
      passed: profile.onboardingCompleted === true,
      value: profile.onboardingCompleted === true,
      threshold: true,
    },
    profileCompleteness: {
      passed: completeness >= TH.MIN_PROFILE_COMPLETENESS,
      value: completeness,
      threshold: TH.MIN_PROFILE_COMPLETENESS,
    },
  }

  const failedChecks = Object.entries(checks)
    .filter(([_, r]) => !r.passed)
    .map(([k]) => k)

  // ── 5. Tier 3 hard-floor short-circuits (auto-reject) ───────────
  // These are non-negotiable. A user failing any of these is
  // auto-rejected immediately; no manual-review path.
  const hardFloorFails: string[] = []
  if (user.emailVerifiedAt === null) {
    hardFloorFails.push('email_not_verified')
  }
  if (!profile.profileImageUrl) {
    hardFloorFails.push('no_profile_photo')
  }
  if (bioLength < TH.REJECTION_BIO_LENGTH) {
    hardFloorFails.push('bio_too_short')
  }
  if (socialHandleCount === 0) {
    hardFloorFails.push('no_social_handles')
  }
  if (accountAgeDays < TH.REJECTION_ACCOUNT_AGE_DAYS) {
    hardFloorFails.push('account_too_new')
  }
  if (completeness < TH.REJECTION_PROFILE_COMPLETENESS) {
    hardFloorFails.push('profile_completeness_too_low')
  }
  if (hardFloorFails.length > 0) {
    return {
      tier: 3,
      autoDecision: 'reject',
      checks,
      failedChecks: hardFloorFails,
      totalFollowers,
      hasApiVerifiedHandle,
      reason: `Auto-rejected — hard floor failed: ${hardFloorFails.join(', ')}`,
    }
  }

  // ── 6. If any basic check failed (but no hard floor) → review ──
  // Borderline cases land in admin queue rather than auto-reject;
  // the admin sees the threshold context and can approve manually.
  if (failedChecks.length > 0) {
    return {
      tier: 2,
      autoDecision: 'review',
      checks,
      failedChecks,
      totalFollowers,
      hasApiVerifiedHandle,
      reason: `Manual review — basic checks borderline: ${failedChecks.join(', ')}`,
    }
  }

  // ── 7. All 8 basic checks passed — now decide on follower bar ──
  // Tier 2 (manual review) if:
  //   - followers in [MANUAL_REVIEW_FOLLOWERS_MIN, AUTO_APPROVE_FOLLOWERS), OR
  //   - self-reported followers > MAX_AUTO_APPROVE_FOLLOWERS (fraud guard)
  //   - account age 1-7 days (already caught above — kept here for parity)
  if (totalFollowers < TH.AUTO_APPROVE_FOLLOWERS) {
    if (totalFollowers >= TH.MANUAL_REVIEW_FOLLOWERS_MIN) {
      return {
        tier: 2,
        autoDecision: 'review',
        checks,
        failedChecks: [],
        totalFollowers,
        hasApiVerifiedHandle,
        reason: `Manual review — followers (${totalFollowers}) in 500-999 borderline range`,
      }
    }
    // Below 500 — no auto path; treated as soft fail of the follower check.
    return {
      tier: 2,
      autoDecision: 'review',
      checks: {
        ...checks,
        followerThreshold: {
          passed: false,
          value: totalFollowers,
          threshold: TH.MANUAL_REVIEW_FOLLOWERS_MIN,
        },
      },
      failedChecks: ['follower_count_below_min'],
      totalFollowers,
      hasApiVerifiedHandle,
      reason: `Manual review — followers (${totalFollowers}) below 500 manual-review floor`,
    }
  }

  if (totalFollowers > TH.MAX_AUTO_APPROVE_FOLLOWERS && !hasApiVerifiedHandle) {
    return {
      tier: 2,
      autoDecision: 'review',
      checks,
      failedChecks: ['follower_count_above_trust_cap'],
      totalFollowers,
      hasApiVerifiedHandle,
      reason: `Manual review — self-reported followers (${totalFollowers}) > ${TH.MAX_AUTO_APPROVE_FOLLOWERS} fraud cap; no OAuth-verified handle to corroborate`,
    }
  }

  // ── 8. Tier 1 — all 8 + follower bar all green ──────────────────
  return {
    tier: 1,
    autoDecision: 'approve',
    checks,
    failedChecks: [],
    totalFollowers,
    hasApiVerifiedHandle,
    reason: `Auto-approved — all 8 checks passed; followers ${totalFollowers}${hasApiVerifiedHandle ? ' (OAuth-verified)' : ''}`,
  }
}
