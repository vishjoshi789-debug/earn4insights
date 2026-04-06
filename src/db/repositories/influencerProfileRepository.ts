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
    'instagramHandle' | 'youtubeHandle' | 'twitterHandle' | 'linkedinHandle' |
    'baseRate' | 'currency' | 'portfolioUrls'
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
