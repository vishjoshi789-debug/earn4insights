import 'server-only'

import { db } from '@/db'
import {
  influencerContentPosts,
  type InfluencerContentPost,
  type NewInfluencerContentPost,
} from '@/db/schema'
import { eq, and, desc } from 'drizzle-orm'

// ── Create ───────────────────────────────────────────────────────

export async function createPost(
  data: Omit<NewInfluencerContentPost, 'id' | 'createdAt' | 'updatedAt'>
): Promise<InfluencerContentPost> {
  const [row] = await db
    .insert(influencerContentPosts)
    .values(data)
    .returning()
  return row
}

// ── Read ─────────────────────────────────────────────────────────

export async function getPostById(id: string): Promise<InfluencerContentPost | null> {
  const rows = await db
    .select()
    .from(influencerContentPosts)
    .where(eq(influencerContentPosts.id, id))
    .limit(1)
  return rows[0] ?? null
}

export async function getPostsByInfluencer(
  influencerId: string,
  opts?: { status?: string; campaignId?: string; limit?: number; offset?: number }
): Promise<InfluencerContentPost[]> {
  const conditions = [eq(influencerContentPosts.influencerId, influencerId)]

  if (opts?.status) {
    conditions.push(eq(influencerContentPosts.status, opts.status as any))
  }
  if (opts?.campaignId) {
    conditions.push(eq(influencerContentPosts.campaignId, opts.campaignId))
  }

  return db
    .select()
    .from(influencerContentPosts)
    .where(and(...conditions))
    .orderBy(desc(influencerContentPosts.createdAt))
    .limit(opts?.limit ?? 50)
    .offset(opts?.offset ?? 0)
}

export async function getPostsByCampaign(campaignId: string): Promise<InfluencerContentPost[]> {
  return db
    .select()
    .from(influencerContentPosts)
    .where(eq(influencerContentPosts.campaignId, campaignId))
    .orderBy(desc(influencerContentPosts.createdAt))
}

// ── Update ───────────────────────────────────────────────────────

export async function updatePost(
  id: string,
  data: Partial<Pick<
    NewInfluencerContentPost,
    'title' | 'body' | 'mediaType' | 'mediaUrls' | 'thumbnailUrl' |
    'platformsCrossPosted' | 'productId' | 'brandId' | 'campaignId' |
    'tags' | 'externalPostUrls'
  >>
): Promise<InfluencerContentPost> {
  const [updated] = await db
    .update(influencerContentPosts)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(influencerContentPosts.id, id))
    .returning()

  if (!updated) throw new Error(`Content post not found: ${id}`)
  return updated
}

export async function updatePostStatus(
  id: string,
  status: string,
  publishedAt?: Date
): Promise<InfluencerContentPost> {
  const [updated] = await db
    .update(influencerContentPosts)
    .set({
      status: status as any,
      ...(publishedAt ? { publishedAt } : {}),
      updatedAt: new Date(),
    })
    .where(eq(influencerContentPosts.id, id))
    .returning()

  if (!updated) throw new Error(`Content post not found: ${id}`)
  return updated
}

// ── Delete ───────────────────────────────────────────────────────

export async function deletePost(id: string): Promise<void> {
  await db
    .delete(influencerContentPosts)
    .where(eq(influencerContentPosts.id, id))
}
