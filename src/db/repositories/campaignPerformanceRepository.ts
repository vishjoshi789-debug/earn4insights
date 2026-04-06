import 'server-only'

import { db } from '@/db'
import {
  campaignPerformance,
  type CampaignPerformanceRow,
  type NewCampaignPerformanceRow,
} from '@/db/schema'
import { eq, and, desc, sql, gte, lte } from 'drizzle-orm'

// ── Create ───────────────────────────────────────────────────────

export async function recordMetrics(
  data: Omit<NewCampaignPerformanceRow, 'id' | 'createdAt'>
): Promise<CampaignPerformanceRow> {
  const [row] = await db
    .insert(campaignPerformance)
    .values(data)
    .returning()
  return row
}

// ── Read ─────────────────────────────────────────────────────────

export async function getMetricsByCampaign(
  campaignId: string,
  opts?: { platform?: string; startDate?: string; endDate?: string }
): Promise<CampaignPerformanceRow[]> {
  const conditions = [eq(campaignPerformance.campaignId, campaignId)]

  if (opts?.platform) {
    conditions.push(eq(campaignPerformance.platform, opts.platform))
  }
  if (opts?.startDate) {
    conditions.push(gte(campaignPerformance.metricDate, opts.startDate))
  }
  if (opts?.endDate) {
    conditions.push(lte(campaignPerformance.metricDate, opts.endDate))
  }

  return db
    .select()
    .from(campaignPerformance)
    .where(and(...conditions))
    .orderBy(desc(campaignPerformance.metricDate))
}

export async function getMetricsByPost(postId: string): Promise<CampaignPerformanceRow[]> {
  return db
    .select()
    .from(campaignPerformance)
    .where(eq(campaignPerformance.postId, postId))
    .orderBy(desc(campaignPerformance.metricDate))
}

export async function getAggregateByCampaign(campaignId: string): Promise<{
  views: number; likes: number; comments: number; shares: number
  saves: number; clicks: number; reach: number; impressions: number
}> {
  const [row] = await db
    .select({
      views: sql<number>`COALESCE(SUM(${campaignPerformance.views}), 0)`,
      likes: sql<number>`COALESCE(SUM(${campaignPerformance.likes}), 0)`,
      comments: sql<number>`COALESCE(SUM(${campaignPerformance.comments}), 0)`,
      shares: sql<number>`COALESCE(SUM(${campaignPerformance.shares}), 0)`,
      saves: sql<number>`COALESCE(SUM(${campaignPerformance.saves}), 0)`,
      clicks: sql<number>`COALESCE(SUM(${campaignPerformance.clicks}), 0)`,
      reach: sql<number>`COALESCE(SUM(${campaignPerformance.reach}), 0)`,
      impressions: sql<number>`COALESCE(SUM(${campaignPerformance.impressions}), 0)`,
    })
    .from(campaignPerformance)
    .where(eq(campaignPerformance.campaignId, campaignId))

  return {
    views: Number(row?.views ?? 0),
    likes: Number(row?.likes ?? 0),
    comments: Number(row?.comments ?? 0),
    shares: Number(row?.shares ?? 0),
    saves: Number(row?.saves ?? 0),
    clicks: Number(row?.clicks ?? 0),
    reach: Number(row?.reach ?? 0),
    impressions: Number(row?.impressions ?? 0),
  }
}

// ── Delete ───────────────────────────────────────────────────────

export async function deleteMetrics(id: string): Promise<void> {
  await db
    .delete(campaignPerformance)
    .where(eq(campaignPerformance.id, id))
}
