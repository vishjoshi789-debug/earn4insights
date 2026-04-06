import 'server-only'

import { db } from '@/db'
import {
  influencerReviews,
  type InfluencerReview,
  type NewInfluencerReview,
} from '@/db/schema'
import { eq, and, desc, sql } from 'drizzle-orm'

// ── Create ───────────────────────────────────────────────────────

export async function createReview(
  data: Omit<NewInfluencerReview, 'id' | 'createdAt'>
): Promise<InfluencerReview> {
  if (data.rating < 1 || data.rating > 5) {
    throw new Error('Rating must be between 1 and 5')
  }

  const [row] = await db
    .insert(influencerReviews)
    .values(data)
    .returning()
  return row
}

// ── Read ─────────────────────────────────────────────────────────

export async function getReviewsByCampaign(campaignId: string): Promise<InfluencerReview[]> {
  return db
    .select()
    .from(influencerReviews)
    .where(eq(influencerReviews.campaignId, campaignId))
    .orderBy(desc(influencerReviews.createdAt))
}

export async function getReviewsForUser(
  revieweeId: string,
  opts?: { limit?: number; offset?: number }
): Promise<InfluencerReview[]> {
  return db
    .select()
    .from(influencerReviews)
    .where(eq(influencerReviews.revieweeId, revieweeId))
    .orderBy(desc(influencerReviews.createdAt))
    .limit(opts?.limit ?? 50)
    .offset(opts?.offset ?? 0)
}

export async function getReviewByReviewer(
  campaignId: string,
  reviewerId: string
): Promise<InfluencerReview | null> {
  const rows = await db
    .select()
    .from(influencerReviews)
    .where(
      and(
        eq(influencerReviews.campaignId, campaignId),
        eq(influencerReviews.reviewerId, reviewerId)
      )
    )
    .limit(1)
  return rows[0] ?? null
}

export async function getAverageRating(revieweeId: string): Promise<number | null> {
  const [row] = await db
    .select({ avg: sql<number>`AVG(${influencerReviews.rating})` })
    .from(influencerReviews)
    .where(eq(influencerReviews.revieweeId, revieweeId))
  return row?.avg ? Number(row.avg) : null
}

// ── Delete ───────────────────────────────────────────────────────

export async function deleteReview(id: string): Promise<void> {
  await db
    .delete(influencerReviews)
    .where(eq(influencerReviews.id, id))
}
