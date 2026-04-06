/**
 * Influencer Profile Service
 *
 * Handles influencer profile creation, updates, and discovery.
 * - Consumers can register as influencers (sets is_influencer flag)
 * - Brands can search/browse influencer profiles
 * - Social stats are managed alongside profiles
 */

import 'server-only'

import { db } from '@/db'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'
import {
  createProfile,
  getProfileByUserId,
  getProfileById,
  updateProfile,
  updateVerificationStatus,
  searchProfiles,
  deactivateProfile,
} from '@/db/repositories/influencerProfileRepository'
import {
  upsertStats,
  getStatsByInfluencer,
} from '@/db/repositories/influencerSocialStatsRepository'
import {
  getFollowerCount,
} from '@/db/repositories/influencerFollowRepository'
import {
  getAverageRating,
} from '@/db/repositories/influencerReviewRepository'
import type { InfluencerProfile, NewInfluencerProfile } from '@/db/schema'

// ── Types ────────────────────────────────────────────────────────

export type InfluencerPublicProfile = {
  profile: InfluencerProfile
  socialStats: Awaited<ReturnType<typeof getStatsByInfluencer>>
  followerCount: number
  averageRating: number | null
}

// ── Register as influencer ───────────────────────────────────────

export async function registerAsInfluencer(
  userId: string,
  data: {
    displayName: string
    bio?: string
    niche: string[]
    location?: string
    instagramHandle?: string
    youtubeHandle?: string
    twitterHandle?: string
    linkedinHandle?: string
    baseRate?: number
    currency?: string
  }
): Promise<InfluencerProfile> {
  // Check if already registered
  const existing = await getProfileByUserId(userId)
  if (existing) {
    throw new Error('User is already registered as an influencer')
  }

  // Set is_influencer flag on user
  await db
    .update(users)
    .set({ isInfluencer: true })
    .where(eq(users.id, userId))

  // Create influencer profile
  return createProfile({
    userId,
    displayName: data.displayName,
    bio: data.bio ?? null,
    niche: data.niche,
    location: data.location ?? null,
    instagramHandle: data.instagramHandle ?? null,
    youtubeHandle: data.youtubeHandle ?? null,
    twitterHandle: data.twitterHandle ?? null,
    linkedinHandle: data.linkedinHandle ?? null,
    baseRate: data.baseRate ?? null,
    currency: data.currency ?? 'INR',
  })
}

// ── Get public profile ───────────────────────────────────────────

export async function getInfluencerPublicProfile(
  userId: string
): Promise<InfluencerPublicProfile | null> {
  const profile = await getProfileByUserId(userId)
  if (!profile || !profile.isActive) return null

  const [socialStats, followerCount, averageRating] = await Promise.all([
    getStatsByInfluencer(userId),
    getFollowerCount(userId),
    getAverageRating(userId),
  ])

  return { profile, socialStats, followerCount, averageRating }
}

// ── Update profile ───────────────────────────────────────────────

export async function updateInfluencerProfile(
  userId: string,
  data: Parameters<typeof updateProfile>[1]
): Promise<InfluencerProfile> {
  return updateProfile(userId, data)
}

// ── Update social stats ──────────────────────────────────────────

export async function updateSocialStats(
  influencerId: string,
  platform: 'instagram' | 'youtube' | 'twitter' | 'linkedin',
  stats: {
    followerCount?: number
    engagementRate?: string
    avgViews?: number
    avgLikes?: number
    avgComments?: number
  }
): Promise<void> {
  await upsertStats({
    influencerId,
    platform,
    followerCount: stats.followerCount ?? 0,
    engagementRate: stats.engagementRate ?? null,
    avgViews: stats.avgViews ?? null,
    avgLikes: stats.avgLikes ?? null,
    avgComments: stats.avgComments ?? null,
    verificationMethod: 'self_declared',
  })
}

// ── Search / Discovery ───────────────────────────────────────────

export async function discoverInfluencers(opts: {
  niche?: string
  location?: string
  verified?: boolean
  limit?: number
  offset?: number
}): Promise<InfluencerPublicProfile[]> {
  const profiles = await searchProfiles({ ...opts, isActive: true })

  return Promise.all(
    profiles.map(async (profile) => {
      const [socialStats, followerCount, averageRating] = await Promise.all([
        getStatsByInfluencer(profile.userId),
        getFollowerCount(profile.userId),
        getAverageRating(profile.userId),
      ])
      return { profile, socialStats, followerCount, averageRating }
    })
  )
}

// ── Admin actions ────────────────────────────────────────────────

export { updateVerificationStatus, deactivateProfile }
