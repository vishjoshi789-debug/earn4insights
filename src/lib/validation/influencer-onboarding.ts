import { z } from 'zod'

/**
 * Influencer onboarding validation schemas — one Zod schema per wizard
 * step so the client can validate partial saves and the server can
 * re-validate with the same shape.
 *
 * Niche + content-type lists are curated (Q1 + Q2) to keep downstream
 * analytics / segmentation clean without free-text drift. Adding a new
 * niche/type later just means appending here + the next migration.
 */

// 16 curated niches (Q1 approved — health-wellness added for India market).
export const INFLUENCER_NICHES = [
  'beauty',
  'fashion',
  'tech',
  'food',
  'fitness',
  'travel',
  'lifestyle',
  'gaming',
  'education',
  'finance',
  'parenting',
  'music',
  'art',
  'sports',
  'automotive',
  'health-wellness',
] as const

// 9 curated content types (Q2 approved).
export const INFLUENCER_CONTENT_TYPES = [
  'reels',
  'stories',
  'posts',
  'short-form-video',
  'long-form-video',
  'blog-post',
  'podcast',
  'livestream',
  'review',
] as const

// Currencies the wizard offers up front. Aligned with the existing
// /dashboard/influencer/payouts page.
export const INFLUENCER_CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'SGD', 'AED'] as const

// Age brackets used in audience demographics.
export const AGE_BRACKET_KEYS = ['13-17', '18-24', '25-34', '35-44', '45-54', '55+'] as const
export const GENDER_KEYS = ['male', 'female', 'other'] as const

const handleSchema = z
  .string()
  .trim()
  .max(100, 'Handle too long')
  .optional()
  .or(z.literal(''))

const urlOptional = z
  .string()
  .trim()
  .url('Must be a valid URL')
  .max(500, 'URL too long')
  .optional()
  .or(z.literal(''))

// ── Step 2: Profile basics ───────────────────────────────────────
//
// displayName + at least one niche are the only required fields in the
// entire wizard. Everything else is optional or fully skippable.
export const profileBasicsSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(2, 'Display name must be at least 2 characters')
    .max(80, 'Display name must be 80 characters or fewer'),
  bio: z
    .string()
    .trim()
    .max(200, 'Bio must be 200 characters or fewer')
    .optional()
    .or(z.literal('')),
  niche: z
    .array(z.enum(INFLUENCER_NICHES))
    .min(1, 'Pick at least one niche')
    .max(5, 'Pick up to 5 niches'),
  location: z
    .string()
    .trim()
    .max(100, 'Location too long')
    .optional()
    .or(z.literal('')),
  profileImageUrl: urlOptional,
})

// ── Step 3: Social handles (all optional, fully skippable) ───────
export const socialHandlesSchema = z.object({
  instagramHandle: handleSchema,
  youtubeHandle: handleSchema,
  twitterHandle: handleSchema,
  linkedinHandle: handleSchema,
  tiktokHandle: handleSchema,
})

// ── Step 4: Audience + rates (all optional, fully skippable) ─────
//
// Per-platform follower counts go into influencer_social_stats; the
// engagement rate similarly. baseRate + currency + contentTypes +
// audienceDemographics live on influencer_profiles.

const platformStatsSchema = z.object({
  followerCount: z
    .number()
    .int()
    .min(0, 'Follower count must be non-negative')
    .max(10_000_000_000, 'That follower count is unrealistically high')
    .optional()
    .nullable(),
  engagementRate: z
    .number()
    .min(0, 'Engagement rate must be non-negative')
    .max(100, 'Engagement rate is a percentage (0–100)')
    .optional()
    .nullable(),
})

const percentageSplitSchema = z
  .record(z.string(), z.number().min(0).max(100))
  .refine(
    (val) => {
      const sum = Object.values(val).reduce((acc, n) => acc + (Number.isFinite(n) ? n : 0), 0)
      return sum <= 100.5 // small tolerance for float arithmetic
    },
    { message: 'Percentages must add up to 100 or less' },
  )

export const audienceDemographicsSchema = z.object({
  ageBrackets: percentageSplitSchema.optional(),
  gender: percentageSplitSchema.optional(),
  topCountries: z
    .array(z.string().trim().min(2).max(50))
    .max(5, 'Pick up to 5 countries')
    .optional(),
})

export const audienceAndRatesSchema = z.object({
  // Per-platform stats — keyed by the same platform names as the social
  // handles in step 3.
  socialStats: z
    .object({
      instagram: platformStatsSchema.optional(),
      youtube: platformStatsSchema.optional(),
      twitter: platformStatsSchema.optional(),
      linkedin: platformStatsSchema.optional(),
      tiktok: platformStatsSchema.optional(),
    })
    .optional(),
  baseRate: z
    .number()
    .int()
    .min(0, 'Rate must be non-negative')
    .max(100_000_000_00, 'Rate too high') // 10,00,00,000 INR in paise
    .optional()
    .nullable(),
  currency: z.enum(INFLUENCER_CURRENCIES).optional(),
  contentTypes: z
    .array(z.enum(INFLUENCER_CONTENT_TYPES))
    .max(INFLUENCER_CONTENT_TYPES.length, 'Too many content types')
    .optional(),
  audienceDemographics: audienceDemographicsSchema.optional(),
})

// ── Composite: full wizard payload (used on final submit) ────────
//
// Only profileBasicsSchema fields are required at completion time.
// Everything else may still be empty if the influencer skipped optional
// steps — that's by design (Q3 + Q4 skippability).
export const completeInfluencerOnboardingSchema = profileBasicsSchema
  .merge(socialHandlesSchema)
  .merge(audienceAndRatesSchema)

export type ProfileBasicsInput = z.infer<typeof profileBasicsSchema>
export type SocialHandlesInput = z.infer<typeof socialHandlesSchema>
export type AudienceAndRatesInput = z.infer<typeof audienceAndRatesSchema>
export type AudienceDemographicsInput = z.infer<typeof audienceDemographicsSchema>
export type CompleteInfluencerOnboardingInput = z.infer<typeof completeInfluencerOnboardingSchema>

// Human-readable labels for the curated lists — UI maps over these
// for chips / multi-selects.
export const NICHE_LABELS: Record<(typeof INFLUENCER_NICHES)[number], string> = {
  beauty: 'Beauty',
  fashion: 'Fashion',
  tech: 'Tech',
  food: 'Food',
  fitness: 'Fitness',
  travel: 'Travel',
  lifestyle: 'Lifestyle',
  gaming: 'Gaming',
  education: 'Education',
  finance: 'Finance',
  parenting: 'Parenting',
  music: 'Music',
  art: 'Art',
  sports: 'Sports',
  automotive: 'Automotive',
  'health-wellness': 'Health & Wellness',
}

export const CONTENT_TYPE_LABELS: Record<(typeof INFLUENCER_CONTENT_TYPES)[number], string> = {
  reels: 'Reels',
  stories: 'Stories',
  posts: 'Posts',
  'short-form-video': 'Short-form video',
  'long-form-video': 'Long-form video',
  'blog-post': 'Blog post',
  podcast: 'Podcast',
  livestream: 'Livestream',
  review: 'Review',
}

export const AGE_BRACKET_LABELS: Record<(typeof AGE_BRACKET_KEYS)[number], string> = {
  '13-17': '13–17',
  '18-24': '18–24',
  '25-34': '25–34',
  '35-44': '35–44',
  '45-54': '45–54',
  '55+': '55+',
}

export const GENDER_LABELS: Record<(typeof GENDER_KEYS)[number], string> = {
  male: 'Male',
  female: 'Female',
  other: 'Other / non-binary',
}
