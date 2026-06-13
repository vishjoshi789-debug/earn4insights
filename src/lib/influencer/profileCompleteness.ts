/**
 * Shared influencer profile-completeness scoring.
 *
 * Extracted in A9 from the inline implementation that originally lived
 * at the top of `src/app/dashboard/page.tsx`. Two consumers now share
 * this single source of truth:
 *
 *   1. Influencer dashboard home — renders the percentage stat card +
 *      "Boost your profile" missing-factor list.
 *   2. `verificationThresholdService.evaluateVerificationRequest` — uses
 *      the same score to enforce the A9 Tier-1 `MIN_PROFILE_COMPLETENESS`
 *      check (default 80%). Without extraction, both would have drifted.
 *
 * Weighting (sum: 100):
 *   displayName 10 · niche 10 · bio 10 · photo 15 · rate 10 ·
 *   contentTypes 10 · socials 15 · audience 10 · location 5 · portfolio 5
 *
 * **Known cap:** the `portfolio` factor's `check()` always returns false
 * because the wizard doesn't capture portfolio links yet. Real-world max
 * is 95%, not 100%. The A9 80% threshold sits comfortably under that.
 */

export interface InfluencerProfileLite {
  displayName: string | null
  bio: string | null
  niche: string[] | null
  location: string | null
  profileImageUrl: string | null
  baseRate: number | null
  currency: string | null
  contentTypes: string[] | null
  audienceDemographics: Record<string, unknown> | null
  verificationStatus: 'unverified' | 'pending' | 'verified' | null
  instagramHandle: string | null
  youtubeHandle: string | null
  twitterHandle: string | null
  linkedinHandle: string | null
  tiktokHandle: string | null
}

export interface CompletenessFactor {
  key: string
  label: string
  weight: number
  check: (p: InfluencerProfileLite | null) => boolean
  href: string
}

const PROFILE_EDIT_HREF = '/dashboard/influencer/profile'

export const COMPLETENESS_FACTORS: CompletenessFactor[] = [
  { key: 'displayName',  label: 'Display name',          weight: 10, check: (p) => !!(p?.displayName?.trim()),                                                              href: PROFILE_EDIT_HREF },
  { key: 'niche',        label: 'At least one niche',    weight: 10, check: (p) => (p?.niche?.length ?? 0) > 0,                                                              href: PROFILE_EDIT_HREF },
  { key: 'bio',          label: 'Short bio',             weight: 10, check: (p) => !!(p?.bio?.trim()),                                                                       href: PROFILE_EDIT_HREF },
  { key: 'photo',        label: 'Profile photo',         weight: 15, check: (p) => !!p?.profileImageUrl,                                                                     href: PROFILE_EDIT_HREF },
  { key: 'rate',         label: 'Base rate',             weight: 10, check: (p) => !!p?.baseRate && p.baseRate > 0,                                                          href: PROFILE_EDIT_HREF },
  { key: 'contentTypes', label: 'Content types',         weight: 10, check: (p) => (p?.contentTypes?.length ?? 0) > 0,                                                       href: PROFILE_EDIT_HREF },
  { key: 'socials',      label: 'Social handles',        weight: 15, check: (p) => !!(p?.instagramHandle || p?.youtubeHandle || p?.twitterHandle || p?.linkedinHandle || p?.tiktokHandle), href: PROFILE_EDIT_HREF },
  { key: 'audience',     label: 'Audience demographics', weight: 10, check: (p) => !!p?.audienceDemographics && Object.keys(p.audienceDemographics).length > 0,              href: PROFILE_EDIT_HREF },
  { key: 'location',     label: 'Location',              weight:  5, check: (p) => !!(p?.location?.trim()),                                                                  href: PROFILE_EDIT_HREF },
  { key: 'portfolio',    label: 'Portfolio links',       weight:  5, check: () => false,                                                                                     href: PROFILE_EDIT_HREF },
]

/**
 * Compute profile completeness as a 0–100 score. Real-world max is 95
 * until the portfolio capture UI ships (see file-level comment).
 */
export function calcProfileCompleteness(p: InfluencerProfileLite | null): number {
  if (!p) return 0
  return COMPLETENESS_FACTORS.reduce(
    (sum, f) => sum + (f.check(p) ? f.weight : 0),
    0,
  )
}

/**
 * Return the factors that are NOT satisfied. For a brand-new (null)
 * profile we hide the future-reserved `portfolio` factor so the empty
 * state doesn't tell the user to do something they can't do yet.
 */
export function getMissingProfileFactors(p: InfluencerProfileLite | null): CompletenessFactor[] {
  if (!p) return COMPLETENESS_FACTORS.filter(f => f.key !== 'portfolio')
  return COMPLETENESS_FACTORS.filter(f => !f.check(p))
}
