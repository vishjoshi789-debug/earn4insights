import 'server-only'

import { db } from '@/db'
import {
  influencerSocialStats,
  type InfluencerSocialStat,
  type NewInfluencerSocialStat,
} from '@/db/schema'
import { eq, and, desc, sql } from 'drizzle-orm'

// ── Upsert ───────────────────────────────────────────────────────

export async function upsertStats(
  data: Omit<NewInfluencerSocialStat, 'id' | 'createdAt' | 'updatedAt'>
): Promise<InfluencerSocialStat> {
  const now = new Date()
  const [row] = await db
    .insert(influencerSocialStats)
    .values({ ...data, updatedAt: now })
    .onConflictDoUpdate({
      target: [influencerSocialStats.influencerId, influencerSocialStats.platform],
      set: {
        followerCount: data.followerCount,
        engagementRate: data.engagementRate,
        avgViews: data.avgViews,
        avgLikes: data.avgLikes,
        avgComments: data.avgComments,
        verifiedAt: data.verifiedAt,
        verificationMethod: data.verificationMethod,
        rawApiResponse: data.rawApiResponse,
        updatedAt: now,
      },
    })
    .returning()
  return row
}

// ── Read ─────────────────────────────────────────────────────────

export async function getStatsByInfluencer(influencerId: string): Promise<InfluencerSocialStat[]> {
  return db
    .select()
    .from(influencerSocialStats)
    .where(eq(influencerSocialStats.influencerId, influencerId))
    .orderBy(desc(influencerSocialStats.followerCount))
}

export async function getStatsByPlatform(
  influencerId: string,
  platform: string
): Promise<InfluencerSocialStat | null> {
  const rows = await db
    .select()
    .from(influencerSocialStats)
    .where(
      and(
        eq(influencerSocialStats.influencerId, influencerId),
        eq(influencerSocialStats.platform, platform)
      )
    )
    .limit(1)
  return rows[0] ?? null
}

// ── Delete ───────────────────────────────────────────────────────

export async function deleteStats(influencerId: string, platform: string): Promise<void> {
  await db
    .delete(influencerSocialStats)
    .where(
      and(
        eq(influencerSocialStats.influencerId, influencerId),
        eq(influencerSocialStats.platform, platform)
      )
    )
}
