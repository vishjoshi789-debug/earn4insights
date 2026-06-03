import 'server-only'

import { db } from '@/db'
import {
  influencerProfiles,
  type InfluencerProfile,
  type NewInfluencerProfile,
} from '@/db/schema'
import { eq, and, desc, sql, count } from 'drizzle-orm'

// ── Create ───────────────────────────────────────────────────────

export async function createProfile(
  data: Omit<NewInfluencerProfile, 'id' | 'createdAt' | 'updatedAt'>
): Promise<InfluencerProfile> {
  const [row] = await db
    .insert(influencerProfiles)
    .values(data)
    .returning()
  return row
}

// ── Read ─────────────────────────────────────────────────────────

export async function getProfileByUserId(userId: string): Promise<InfluencerProfile | null> {
  const rows = await db
    .select()
    .from(influencerProfiles)
    .where(eq(influencerProfiles.userId, userId))
    .limit(1)
  return rows[0] ?? null
}

export async function getProfileById(id: string): Promise<InfluencerProfile | null> {
  const rows = await db
    .select()
    .from(influencerProfiles)
    .where(eq(influencerProfiles.id, id))
    .limit(1)
  return rows[0] ?? null
}

export async function searchProfiles(opts: {
  niche?: string
  location?: string
  isActive?: boolean
  verified?: boolean
  limit?: number
  offset?: number
}): Promise<InfluencerProfile[]> {
  const conditions = []

  if (opts.niche) {
    conditions.push(sql`${influencerProfiles.niche} @> ARRAY[${opts.niche}]`)
  }
  if (opts.location) {
    conditions.push(eq(influencerProfiles.location, opts.location))
  }
  if (opts.isActive !== undefined) {
    conditions.push(eq(influencerProfiles.isActive, opts.isActive))
  }
  if (opts.verified) {
    conditions.push(eq(influencerProfiles.verificationStatus, 'verified'))
  }

  return db
    .select()
    .from(influencerProfiles)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(influencerProfiles.createdAt))
    .limit(opts.limit ?? 50)
    .offset(opts.offset ?? 0)
}

export async function getActiveProfileCount(): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(influencerProfiles)
    .where(eq(influencerProfiles.isActive, true))
  return row?.total ?? 0
}

// ── Update ───────────────────────────────────────────────────────

export async function updateProfile(
  userId: string,
  data: Partial<Pick<
    NewInfluencerProfile,
    'displayName' | 'bio' | 'niche' | 'location' |
    'instagramHandle' | 'youtubeHandle' | 'twitterHandle' | 'linkedinHandle' | 'tiktokHandle' |
    'baseRate' | 'currency' | 'portfolioUrls' |
    'profileImageUrl' | 'contentTypes' | 'audienceDemographics'
  >>
): Promise<InfluencerProfile> {
  const [updated] = await db
    .update(influencerProfiles)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(influencerProfiles.userId, userId))
    .returning()

  if (!updated) throw new Error(`Influencer profile not found for user: ${userId}`)
  return updated
}

// ── 3.5C wizard helpers ───────────────────────────────────────────

/**
 * Has the influencer finished the 3.5C wizard? Used by OnboardingGuard
 * (replacing the 3.5B bypass) and the future grandfather banner (3.5G).
 * A NULL row counts as "not completed" — caller decides redirect target.
 */
export async function hasCompletedInfluencerOnboarding(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ done: influencerProfiles.onboardingCompleted })
    .from(influencerProfiles)
    .where(eq(influencerProfiles.userId, userId))
    .limit(1)
  return row?.done === true
}

/**
 * Upsert pattern for incremental wizard saves. Each step calls this
 * with the fields it controls. The first call creates the row
 * (displayName + niche MUST be present in the payload since they are
 * NOT NULL on the table — the wizard enforces this on step 2).
 * Subsequent calls patch without re-supplying required cols.
 *
 * Throws when called for the FIRST time without displayName + niche
 * (e.g. a malformed step-3-first attempt). The wizard prevents this
 * by gating step navigation on step-2 validity.
 */
export async function upsertInfluencerProfile(
  userId: string,
  patch: Partial<Omit<NewInfluencerProfile, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>,
): Promise<InfluencerProfile> {
  const existing = await getProfileByUserId(userId)

  if (existing) {
    const [updated] = await db
      .update(influencerProfiles)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(influencerProfiles.userId, userId))
      .returning()
    return updated
  }

  if (!patch.displayName || !patch.niche || patch.niche.length === 0) {
    throw new Error(
      'Influencer profile not yet created — first save must include displayName + at least one niche',
    )
  }

  const [inserted] = await db
    .insert(influencerProfiles)
    .values({
      userId,
      displayName: patch.displayName,
      niche: patch.niche,
      bio: patch.bio ?? null,
      location: patch.location ?? null,
      instagramHandle: patch.instagramHandle ?? null,
      youtubeHandle: patch.youtubeHandle ?? null,
      twitterHandle: patch.twitterHandle ?? null,
      linkedinHandle: patch.linkedinHandle ?? null,
      tiktokHandle: patch.tiktokHandle ?? null,
      baseRate: patch.baseRate ?? null,
      currency: patch.currency ?? 'INR',
      profileImageUrl: patch.profileImageUrl ?? null,
      contentTypes: patch.contentTypes ?? [],
      audienceDemographics: patch.audienceDemographics ?? {},
      onboardingCompleted: patch.onboardingCompleted ?? false,
      onboardingCompletedAt: patch.onboardingCompletedAt ?? null,
    })
    .returning()
  return inserted
}

/**
 * Atomically mark onboarding complete + stamp the timestamp. Returns
 * the updated row or null if the row doesn't exist (caller should have
 * created the row via upsertInfluencerProfile in step 2 first).
 */
export async function markInfluencerOnboardingComplete(userId: string): Promise<InfluencerProfile | null> {
  const [updated] = await db
    .update(influencerProfiles)
    .set({
      onboardingCompleted: true,
      onboardingCompletedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(influencerProfiles.userId, userId))
    .returning()
  return updated ?? null
}

export async function updateVerificationStatus(
  userId: string,
  status: 'unverified' | 'pending' | 'verified'
): Promise<void> {
  await db
    .update(influencerProfiles)
    .set({ verificationStatus: status, updatedAt: new Date() })
    .where(eq(influencerProfiles.userId, userId))
}

export async function deactivateProfile(userId: string): Promise<void> {
  await db
    .update(influencerProfiles)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(influencerProfiles.userId, userId))
}
