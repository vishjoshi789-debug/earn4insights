'use server'

import { auth } from '@/lib/auth/auth.config'
import { db } from '@/db'
import { auditLog, users } from '@/db/schema'
import { eq } from 'drizzle-orm'
import {
  getProfileByUserId,
  upsertInfluencerProfile,
  markInfluencerOnboardingComplete,
} from '@/db/repositories/influencerProfileRepository'
import { upsertStats } from '@/db/repositories/influencerSocialStatsRepository'
import {
  profileBasicsSchema,
  socialHandlesSchema,
  audienceAndRatesSchema,
  completeInfluencerOnboardingSchema,
  type ProfileBasicsInput,
  type SocialHandlesInput,
  type AudienceAndRatesInput,
} from '@/lib/validation/influencer-onboarding'

/**
 * Influencer onboarding server actions — invoked from the 6-step wizard UI.
 *
 * Mirrors brand-onboarding.actions.ts. Next.js server actions carry
 * framework-level origin-checked CSRF; no app-level CSRF needed.
 *
 * Auth: every action re-verifies session + role. We accept BOTH:
 *   - role='influencer' (pure influencer signup, 3.5B)
 *   - role='consumer' (dual-role / cross-role upgrade; the wizard
 *     in 3.5F is reachable from settings for an existing consumer)
 *   - admin (debug / impersonation contexts)
 *
 * We never trust client-supplied role hints — user id + role come
 * from the session.
 */

interface ActionOk<T = undefined> {
  ok: true
  data?: T
}
interface ActionErr {
  ok: false
  error: string
  fieldErrors?: Record<string, string>
}
type ActionResult<T = undefined> = ActionOk<T> | ActionErr

async function requireInfluencerCapable(): Promise<{ userId: string } | ActionErr> {
  const session = await auth()
  if (!session?.user?.id || !session?.user?.email) {
    return { ok: false, error: 'Not signed in' }
  }
  const role = (session.user as any).role
  if (role !== 'influencer' && role !== 'consumer' && role !== 'admin') {
    return { ok: false, error: 'Influencer access required' }
  }
  return { userId: (session.user as any).id }
}

function flattenZodErrors(error: { issues: Array<{ path: (string | number)[]; message: string }> }) {
  const out: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_root'
    if (!out[key]) out[key] = issue.message
  }
  return out
}

// ── Step 2: Profile basics ──────────────────────────────────────
export async function saveProfileBasicsAction(
  raw: unknown,
): Promise<ActionResult> {
  const guard = await requireInfluencerCapable()
  if ('ok' in guard) return guard

  const parsed = profileBasicsSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: 'Validation failed', fieldErrors: flattenZodErrors(parsed.error) }
  }

  const data: ProfileBasicsInput = parsed.data
  await upsertInfluencerProfile(guard.userId, {
    displayName: data.displayName,
    niche: data.niche,
    bio: data.bio || null,
    location: data.location || null,
    profileImageUrl: data.profileImageUrl || null,
  })

  return { ok: true }
}

// ── Step 3: Social handles ──────────────────────────────────────
export async function saveSocialHandlesAction(
  raw: unknown,
): Promise<ActionResult> {
  const guard = await requireInfluencerCapable()
  if ('ok' in guard) return guard

  const parsed = socialHandlesSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: 'Validation failed', fieldErrors: flattenZodErrors(parsed.error) }
  }

  // Refuse if step 2 wasn't completed yet — row must exist with
  // displayName + niche before partial updates make sense.
  const existing = await getProfileByUserId(guard.userId)
  if (!existing) {
    return { ok: false, error: 'Complete step 2 (profile basics) first' }
  }

  const data: SocialHandlesInput = parsed.data
  await upsertInfluencerProfile(guard.userId, {
    instagramHandle: data.instagramHandle || null,
    youtubeHandle: data.youtubeHandle || null,
    twitterHandle: data.twitterHandle || null,
    linkedinHandle: data.linkedinHandle || null,
    tiktokHandle: data.tiktokHandle || null,
  })

  return { ok: true }
}

// ── Step 4: Audience + Rates ────────────────────────────────────
export async function saveAudienceAndRatesAction(
  raw: unknown,
): Promise<ActionResult> {
  const guard = await requireInfluencerCapable()
  if ('ok' in guard) return guard

  const parsed = audienceAndRatesSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: 'Validation failed', fieldErrors: flattenZodErrors(parsed.error) }
  }

  const existing = await getProfileByUserId(guard.userId)
  if (!existing) {
    return { ok: false, error: 'Complete step 2 (profile basics) first' }
  }

  const data: AudienceAndRatesInput = parsed.data

  // Persist profile-level fields.
  await upsertInfluencerProfile(guard.userId, {
    baseRate: typeof data.baseRate === 'number' ? data.baseRate : null,
    currency: data.currency ?? existing.currency,
    contentTypes: data.contentTypes ?? [],
    audienceDemographics: data.audienceDemographics ?? {},
  })

  // Persist per-platform social stats via upsertStats (existing repo).
  // We only write a stats row when the user provided either follower
  // count or engagement rate for that platform; empty objects are
  // skipped so we don't churn rows.
  const platforms: Array<'instagram' | 'youtube' | 'twitter' | 'linkedin'> = [
    'instagram', 'youtube', 'twitter', 'linkedin',
  ]
  for (const platform of platforms) {
    const stats = data.socialStats?.[platform]
    if (!stats) continue
    if (stats.followerCount == null && stats.engagementRate == null) continue
    await upsertStats({
      influencerId: guard.userId,
      platform,
      followerCount: stats.followerCount ?? 0,
      // engagementRate column is decimal(5,2) — string in Drizzle.
      engagementRate:
        stats.engagementRate != null ? stats.engagementRate.toFixed(2) : null,
      avgViews: null,
      avgLikes: null,
      avgComments: null,
      verificationMethod: 'self_declared',
    })
  }
  // Note: influencer_social_stats currently only types these 4
  // platforms ('instagram'|'youtube'|'twitter'|'linkedin'). TikTok
  // stats are accepted in the Zod schema but skipped here until the
  // platform enum is extended in a future migration.

  return { ok: true }
}

// ── Step 5/6: Mark onboarding complete ──────────────────────────
//
// The wizard hits this when the user clicks "Done" on the final
// screen. Step 5 (payout setup) is a skip-with-CTA pattern — no data
// to save here. Step 5's [Add Now] button navigates to
// /dashboard/influencer/payouts where the existing polished page
// handles account creation.
export async function completeInfluencerOnboardingAction(
  raw: unknown,
): Promise<ActionResult> {
  const guard = await requireInfluencerCapable()
  if ('ok' in guard) return guard

  // Final composite validation — re-validates the entire payload
  // against the composite schema so we catch any state where the
  // wizard somehow let an invalid field slip through.
  const existing = await getProfileByUserId(guard.userId)
  if (!existing) {
    return { ok: false, error: 'Complete the earlier steps first' }
  }

  // Build a merged view of what's in the DB now + any final overrides
  // from the raw payload (the wizard may submit minor edits on the
  // final screen). Required fields (displayName + niche) come from DB.
  const merged = {
    displayName: existing.displayName,
    bio: existing.bio ?? '',
    niche: existing.niche ?? [],
    location: existing.location ?? '',
    profileImageUrl: existing.profileImageUrl ?? '',
    instagramHandle: existing.instagramHandle ?? '',
    youtubeHandle: existing.youtubeHandle ?? '',
    twitterHandle: existing.twitterHandle ?? '',
    linkedinHandle: existing.linkedinHandle ?? '',
    tiktokHandle: existing.tiktokHandle ?? '',
    baseRate: existing.baseRate ?? null,
    currency: existing.currency,
    contentTypes: existing.contentTypes ?? [],
    audienceDemographics: existing.audienceDemographics ?? {},
    ...((raw && typeof raw === 'object') ? (raw as Record<string, unknown>) : {}),
  }

  const parsed = completeInfluencerOnboardingSchema.safeParse(merged)
  if (!parsed.success) {
    return { ok: false, error: 'Validation failed', fieldErrors: flattenZodErrors(parsed.error) }
  }

  // Flip the onboarding-complete flag + audit log.
  const completed = await markInfluencerOnboardingComplete(guard.userId)
  if (!completed) {
    return { ok: false, error: 'Failed to mark onboarding complete' }
  }

  // Ensure users.is_influencer flag is set in case this is a
  // consumer-turned-influencer (3.5F upgrade path); for pure
  // influencer signups it's already true. Idempotent — UPDATE with
  // same value is a no-op.
  await db.update(users).set({ isInfluencer: true }).where(eq(users.id, guard.userId))

  // Audit log — onboarding completion is a financial-relevant moment
  // (the influencer becomes campaign-applyable + payable from here).
  await db.insert(auditLog).values({
    userId: guard.userId,
    action: 'influencer_onboarding_completed',
    dataType: 'influencer_profile',
    accessedBy: guard.userId,
    metadata: {
      displayName: existing.displayName,
      nicheCount: (existing.niche ?? []).length,
      hasProfileImage: !!completed.profileImageUrl,
      hasSocialHandles: !!(
        completed.instagramHandle ||
        completed.youtubeHandle ||
        completed.twitterHandle ||
        completed.linkedinHandle ||
        completed.tiktokHandle
      ),
      hasBaseRate: completed.baseRate != null,
      contentTypeCount: (completed.contentTypes ?? []).length,
      hasAudienceDemographics:
        completed.audienceDemographics != null &&
        Object.keys(completed.audienceDemographics).length > 0,
    },
    reason: 'Influencer finished the onboarding wizard',
  })

  return { ok: true }
}

/**
 * Read-only fetch the wizard uses on mount to hydrate from any saved
 * partial state — also covers the grandfathered-influencer "prefill +
 * skip-through" case (Q7 humane path) where the row already exists
 * from the old single-form flow.
 */
export async function getInfluencerOnboardingState() {
  const guard = await requireInfluencerCapable()
  if ('ok' in guard) return { ok: false as const, error: guard.error }
  const profile = await getProfileByUserId(guard.userId)
  return { ok: true as const, profile }
}
