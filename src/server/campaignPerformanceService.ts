/**
 * Campaign Performance Service
 *
 * Tracks and aggregates performance metrics for influencer campaigns.
 * Metrics can be recorded manually by influencers or pulled via API integrations.
 */

import 'server-only'

import {
  recordMetrics,
  getMetricsByCampaign,
  getMetricsByPost,
  getAggregateByCampaign,
} from '@/db/repositories/campaignPerformanceRepository'
import { getCampaignById } from '@/db/repositories/influencerCampaignRepository'
import { getPostsByCampaign } from '@/db/repositories/influencerContentPostRepository'
import type { CampaignPerformanceRow } from '@/db/schema'

// ── Record metrics ───────────────────────────────────────────────

export async function recordCampaignMetrics(
  campaignId: string,
  userId: string,
  data: {
    postId?: string
    platform: string
    metricDate: string
    views?: number
    likes?: number
    comments?: number
    shares?: number
    saves?: number
    clicks?: number
    reach?: number
    impressions?: number
    icpMatchedViewers?: number
    dataSource?: 'manual' | 'api' | 'estimated'
  }
): Promise<CampaignPerformanceRow> {
  const campaign = await getCampaignById(campaignId)
  if (!campaign) throw new Error('Campaign not found')

  return recordMetrics({
    campaignId,
    postId: data.postId ?? null,
    platform: data.platform,
    metricDate: data.metricDate,
    views: data.views ?? 0,
    likes: data.likes ?? 0,
    comments: data.comments ?? 0,
    shares: data.shares ?? 0,
    saves: data.saves ?? 0,
    clicks: data.clicks ?? 0,
    reach: data.reach ?? 0,
    impressions: data.impressions ?? 0,
    icpMatchedViewers: data.icpMatchedViewers ?? 0,
    dataSource: data.dataSource ?? 'manual',
  })
}

// ── Campaign analytics ───────────────────────────────────────────

export async function getCampaignAnalytics(campaignId: string) {
  const [aggregate, metrics, posts] = await Promise.all([
    getAggregateByCampaign(campaignId),
    getMetricsByCampaign(campaignId),
    getPostsByCampaign(campaignId),
  ])

  // Group metrics by platform
  const byPlatform: Record<string, CampaignPerformanceRow[]> = {}
  for (const m of metrics) {
    if (!byPlatform[m.platform]) byPlatform[m.platform] = []
    byPlatform[m.platform].push(m)
  }

  return {
    aggregate,
    byPlatform,
    totalPosts: posts.length,
    metricCount: metrics.length,
  }
}

export { getMetricsByCampaign, getMetricsByPost, getAggregateByCampaign }
