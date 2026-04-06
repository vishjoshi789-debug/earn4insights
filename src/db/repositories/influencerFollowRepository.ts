import 'server-only'

import { db } from '@/db'
import {
  influencerFollows,
  type InfluencerFollow,
} from '@/db/schema'
import { eq, and, count, desc } from 'drizzle-orm'

// ── Follow / Unfollow ────────────────────────────────────────────

export async function follow(consumerId: string, influencerId: string): Promise<InfluencerFollow> {
  const existing = await getFollowRecord(consumerId, influencerId)
  if (existing) return existing

  const [row] = await db
    .insert(influencerFollows)
    .values({ consumerId, influencerId })
    .returning()
  return row
}

export async function unfollow(consumerId: string, influencerId: string): Promise<void> {
  await db
    .delete(influencerFollows)
    .where(
      and(
        eq(influencerFollows.consumerId, consumerId),
        eq(influencerFollows.influencerId, influencerId)
      )
    )
}

// ── Read ─────────────────────────────────────────────────────────

export async function isFollowing(consumerId: string, influencerId: string): Promise<boolean> {
  const record = await getFollowRecord(consumerId, influencerId)
  return record !== null
}

export async function getFollowers(
  influencerId: string,
  opts?: { limit?: number; offset?: number }
): Promise<InfluencerFollow[]> {
  return db
    .select()
    .from(influencerFollows)
    .where(eq(influencerFollows.influencerId, influencerId))
    .orderBy(desc(influencerFollows.followedAt))
    .limit(opts?.limit ?? 50)
    .offset(opts?.offset ?? 0)
}

export async function getFollowing(
  consumerId: string,
  opts?: { limit?: number; offset?: number }
): Promise<InfluencerFollow[]> {
  return db
    .select()
    .from(influencerFollows)
    .where(eq(influencerFollows.consumerId, consumerId))
    .orderBy(desc(influencerFollows.followedAt))
    .limit(opts?.limit ?? 50)
    .offset(opts?.offset ?? 0)
}

export async function getFollowerCount(influencerId: string): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(influencerFollows)
    .where(eq(influencerFollows.influencerId, influencerId))
  return row?.total ?? 0
}

export async function getFollowingCount(consumerId: string): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(influencerFollows)
    .where(eq(influencerFollows.consumerId, consumerId))
  return row?.total ?? 0
}

// ── Internal ─────────────────────────────────────────────────────

async function getFollowRecord(
  consumerId: string,
  influencerId: string
): Promise<InfluencerFollow | null> {
  const rows = await db
    .select()
    .from(influencerFollows)
    .where(
      and(
        eq(influencerFollows.consumerId, consumerId),
        eq(influencerFollows.influencerId, influencerId)
      )
    )
    .limit(1)
  return rows[0] ?? null
}
