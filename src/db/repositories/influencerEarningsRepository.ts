/**
 * Influencer Earnings Repository
 *
 * DB queries for influencer payment data, campaign performance,
 * and audience demographics (via ICP match scores as proxy).
 *
 * No business logic. No auth checks. Called by influencerEarningsService.
 */

import 'server-only'

import { db } from '@/db'
import {
  campaignPayments,
  campaignMilestones,
  campaignInfluencers,
  influencerCampaigns,
  campaignPerformance,
  icpMatchScores,
  consentRecords,
  userProfiles,
  users,
} from '@/db/schema'
import { eq, and, sql, gte, lte, inArray, isNull } from 'drizzle-orm'

// ── Types ─────────────────────────────────────────────────────────

export interface PaymentFilters {
  from?: string       // ISO date
  to?: string         // ISO date
  status?: string     // 'pending' | 'escrowed' | 'released' | 'refunded'
  campaignId?: string
}

export interface PaymentRow {
  id: string
  campaignId: string
  campaignTitle: string
  brandId: string
  productId: string | null
  milestoneId: string | null
  milestoneTitle: string | null
  amount: number          // smallest unit
  currency: string
  paymentType: string
  status: string
  platformFee: number
  escrowedAt: Date | null
  releasedAt: Date | null
  refundedAt: Date | null
  createdAt: Date
}

export interface PaymentAggregate {
  currency: string
  released: number
  escrowed: number
  pending: number
  refunded: number
  thisMonth: number
}

// ── Queries ─────────────────────────────────────────────────────────

/**
 * Itemised payments for an influencer, with campaign + milestone context.
 */
export async function getPaymentsForInfluencer(
  influencerId: string,
  filters: PaymentFilters = {},
): Promise<PaymentRow[]> {
  const conditions = [eq(campaignInfluencers.influencerId, influencerId)]

  if (filters.status) {
    conditions.push(eq(campaignPayments.status, filters.status as any))
  }
  if (filters.campaignId) {
    conditions.push(eq(campaignPayments.campaignId, filters.campaignId))
  }
  if (filters.from) {
    conditions.push(gte(campaignPayments.createdAt, new Date(filters.from)))
  }
  if (filters.to) {
    conditions.push(lte(campaignPayments.createdAt, new Date(filters.to)))
  }

  const rows = await db
    .select({
      id: campaignPayments.id,
      campaignId: campaignPayments.campaignId,
      campaignTitle: influencerCampaigns.title,
      brandId: influencerCampaigns.brandId,
      productId: influencerCampaigns.productId,
      milestoneId: campaignPayments.milestoneId,
      milestoneTitle: campaignMilestones.title,
      amount: campaignPayments.amount,
      currency: campaignPayments.currency,
      paymentType: campaignPayments.paymentType,
      status: campaignPayments.status,
      platformFee: campaignPayments.platformFee,
      escrowedAt: campaignPayments.escrowedAt,
      releasedAt: campaignPayments.releasedAt,
      refundedAt: campaignPayments.refundedAt,
      createdAt: campaignPayments.createdAt,
    })
    .from(campaignPayments)
    .innerJoin(
      campaignInfluencers,
      and(
        eq(campaignInfluencers.campaignId, campaignPayments.campaignId),
        eq(campaignInfluencers.influencerId, influencerId),
      ),
    )
    .innerJoin(
      influencerCampaigns,
      eq(influencerCampaigns.id, campaignPayments.campaignId),
    )
    .leftJoin(
      campaignMilestones,
      eq(campaignMilestones.id, campaignPayments.milestoneId),
    )
    .where(and(...conditions))
    .orderBy(sql`${campaignPayments.createdAt} DESC`)

  return rows
}

/**
 * Aggregated payment totals grouped by currency.
 */
export async function getPaymentAggregates(
  influencerId: string,
): Promise<PaymentAggregate[]> {
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const rows = await db
    .select({
      currency: campaignPayments.currency,
      released: sql<number>`COALESCE(SUM(CASE WHEN ${campaignPayments.status} = 'released' THEN ${campaignPayments.amount} ELSE 0 END), 0)`,
      escrowed: sql<number>`COALESCE(SUM(CASE WHEN ${campaignPayments.status} = 'escrowed' THEN ${campaignPayments.amount} ELSE 0 END), 0)`,
      pending: sql<number>`COALESCE(SUM(CASE WHEN ${campaignPayments.status} = 'pending' THEN ${campaignPayments.amount} ELSE 0 END), 0)`,
      refunded: sql<number>`COALESCE(SUM(CASE WHEN ${campaignPayments.status} = 'refunded' THEN ${campaignPayments.amount} ELSE 0 END), 0)`,
      thisMonth: sql<number>`COALESCE(SUM(CASE WHEN ${campaignPayments.status} = 'released' AND ${campaignPayments.releasedAt} >= ${monthStart} THEN ${campaignPayments.amount} ELSE 0 END), 0)`,
    })
    .from(campaignPayments)
    .innerJoin(
      campaignInfluencers,
      and(
        eq(campaignInfluencers.campaignId, campaignPayments.campaignId),
        eq(campaignInfluencers.influencerId, influencerId),
      ),
    )
    .groupBy(campaignPayments.currency)

  return rows.map(r => ({
    currency: r.currency,
    released: Number(r.released),
    escrowed: Number(r.escrowed),
    pending: Number(r.pending),
    refunded: Number(r.refunded),
    thisMonth: Number(r.thisMonth),
  }))
}

/**
 * Count of active campaigns for an influencer.
 */
export async function getActiveCampaignCount(
  influencerId: string,
): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(campaignInfluencers)
    .innerJoin(
      influencerCampaigns,
      eq(influencerCampaigns.id, campaignInfluencers.campaignId),
    )
    .where(
      and(
        eq(campaignInfluencers.influencerId, influencerId),
        inArray(campaignInfluencers.status, ['accepted', 'active']),
        eq(influencerCampaigns.status, 'active'),
      ),
    )

  return Number(rows[0]?.count ?? 0)
}

/**
 * Aggregated performance metrics across all campaigns for an influencer.
 */
export async function getAggregatedPerformance(
  influencerId: string,
): Promise<{
  totalViews: number
  totalLikes: number
  totalComments: number
  totalShares: number
  totalSaves: number
  totalClicks: number
  totalReach: number
  totalImpressions: number
  totalIcpMatchedViewers: number
}> {
  const rows = await db
    .select({
      totalViews: sql<number>`COALESCE(SUM(${campaignPerformance.views}), 0)`,
      totalLikes: sql<number>`COALESCE(SUM(${campaignPerformance.likes}), 0)`,
      totalComments: sql<number>`COALESCE(SUM(${campaignPerformance.comments}), 0)`,
      totalShares: sql<number>`COALESCE(SUM(${campaignPerformance.shares}), 0)`,
      totalSaves: sql<number>`COALESCE(SUM(${campaignPerformance.saves}), 0)`,
      totalClicks: sql<number>`COALESCE(SUM(${campaignPerformance.clicks}), 0)`,
      totalReach: sql<number>`COALESCE(SUM(${campaignPerformance.reach}), 0)`,
      totalImpressions: sql<number>`COALESCE(SUM(${campaignPerformance.impressions}), 0)`,
      totalIcpMatchedViewers: sql<number>`COALESCE(SUM(${campaignPerformance.icpMatchedViewers}), 0)`,
    })
    .from(campaignPerformance)
    .innerJoin(
      campaignInfluencers,
      and(
        eq(campaignInfluencers.campaignId, campaignPerformance.campaignId),
        eq(campaignInfluencers.influencerId, influencerId),
      ),
    )

  const r = rows[0]
  return {
    totalViews: Number(r?.totalViews ?? 0),
    totalLikes: Number(r?.totalLikes ?? 0),
    totalComments: Number(r?.totalComments ?? 0),
    totalShares: Number(r?.totalShares ?? 0),
    totalSaves: Number(r?.totalSaves ?? 0),
    totalClicks: Number(r?.totalClicks ?? 0),
    totalReach: Number(r?.totalReach ?? 0),
    totalImpressions: Number(r?.totalImpressions ?? 0),
    totalIcpMatchedViewers: Number(r?.totalIcpMatchedViewers ?? 0),
  }
}

/**
 * Performance breakdown for a single campaign (daily time series).
 */
export async function getCampaignPerformanceTimeSeries(
  campaignId: string,
): Promise<Array<{
  metricDate: string
  platform: string
  views: number
  likes: number
  comments: number
  shares: number
  saves: number
  clicks: number
  reach: number
  impressions: number
  icpMatchedViewers: number
}>> {
  const rows = await db
    .select({
      metricDate: campaignPerformance.metricDate,
      platform: campaignPerformance.platform,
      views: campaignPerformance.views,
      likes: campaignPerformance.likes,
      comments: campaignPerformance.comments,
      shares: campaignPerformance.shares,
      saves: campaignPerformance.saves,
      clicks: campaignPerformance.clicks,
      reach: campaignPerformance.reach,
      impressions: campaignPerformance.impressions,
      icpMatchedViewers: campaignPerformance.icpMatchedViewers,
    })
    .from(campaignPerformance)
    .where(eq(campaignPerformance.campaignId, campaignId))
    .orderBy(sql`${campaignPerformance.metricDate} ASC`)

  return rows.map(r => ({
    metricDate: r.metricDate!,
    platform: r.platform,
    views: r.views ?? 0,
    likes: r.likes ?? 0,
    comments: r.comments ?? 0,
    shares: r.shares ?? 0,
    saves: r.saves ?? 0,
    clicks: r.clicks ?? 0,
    reach: r.reach ?? 0,
    impressions: r.impressions ?? 0,
    icpMatchedViewers: r.icpMatchedViewers ?? 0,
  }))
}

/**
 * Campaign details for a specific campaign (with brand name).
 */
export async function getCampaignWithBrand(campaignId: string) {
  const rows = await db
    .select({
      id: influencerCampaigns.id,
      title: influencerCampaigns.title,
      brandId: influencerCampaigns.brandId,
      brandName: users.name,
      productId: influencerCampaigns.productId,
      status: influencerCampaigns.status,
      budgetTotal: influencerCampaigns.budgetTotal,
      budgetCurrency: influencerCampaigns.budgetCurrency,
      startDate: influencerCampaigns.startDate,
      endDate: influencerCampaigns.endDate,
      targetPlatforms: influencerCampaigns.targetPlatforms,
      icpId: influencerCampaigns.icpId,
    })
    .from(influencerCampaigns)
    .leftJoin(users, eq(users.id, influencerCampaigns.brandId))
    .where(eq(influencerCampaigns.id, campaignId))
    .limit(1)

  return rows[0] ?? null
}

/**
 * Audience demographics via ICP match scores.
 * Returns aggregated demographics from userProfiles of consumers
 * who matched the ICPs associated with the influencer's campaigns.
 *
 * This is a proxy — "ICP-matched audience profile", not actual viewers.
 *
 * GDPR/DPDP compliance: only includes consumers who have an active
 * consent_record for 'demographic' (granted=true, revokedAt IS NULL).
 */
export async function getAudienceViaIcpMatches(
  influencerId: string,
  minScore: number = 50,
): Promise<{
  totalMatched: number
  demographics: Array<{
    gender: string | null
    ageRange: string | null
    location: string | null
    interests: Record<string, string[]> | null
    behavioral: Record<string, any> | null
  }>
}> {
  // Get all ICPs linked to this influencer's campaigns
  const campaignIcps = await db
    .select({ icpId: influencerCampaigns.icpId })
    .from(influencerCampaigns)
    .innerJoin(
      campaignInfluencers,
      and(
        eq(campaignInfluencers.campaignId, influencerCampaigns.id),
        eq(campaignInfluencers.influencerId, influencerId),
      ),
    )
    .where(sql`${influencerCampaigns.icpId} IS NOT NULL`)

  const icpIds = campaignIcps
    .map(r => r.icpId)
    .filter((id): id is string => id !== null)

  if (icpIds.length === 0) {
    return { totalMatched: 0, demographics: [] }
  }

  // Get consumers who match those ICPs above the threshold,
  // but ONLY if they have an active 'demographic' consent record.
  const matched = await db
    .select({
      consumerId: icpMatchScores.consumerId,
      demographics: userProfiles.demographics,
      interests: userProfiles.interests,
      behavioral: userProfiles.behavioral,
    })
    .from(icpMatchScores)
    .innerJoin(userProfiles, eq(userProfiles.id, icpMatchScores.consumerId))
    .innerJoin(
      consentRecords,
      and(
        eq(consentRecords.userId, icpMatchScores.consumerId),
        eq(consentRecords.dataCategory, 'demographic'),
        eq(consentRecords.granted, true),
        isNull(consentRecords.revokedAt),
      ),
    )
    .where(
      and(
        inArray(icpMatchScores.icpId, icpIds),
        gte(icpMatchScores.matchScore, minScore),
      ),
    )

  // Deduplicate by consumerId (a consumer might match multiple ICPs)
  const seen = new Set<string>()
  const unique = matched.filter(r => {
    if (seen.has(r.consumerId)) return false
    seen.add(r.consumerId)
    return true
  })

  return {
    totalMatched: unique.length,
    demographics: unique.map(r => ({
      gender: (r.demographics as any)?.gender ?? null,
      ageRange: (r.demographics as any)?.ageRange ?? null,
      location: (r.demographics as any)?.location ?? null,
      interests: r.interests as Record<string, string[]> | null,
      behavioral: r.behavioral as Record<string, any> | null,
    })),
  }
}

/**
 * Verify an influencer is part of a campaign.
 */
export async function isInfluencerInCampaign(
  influencerId: string,
  campaignId: string,
): Promise<boolean> {
  const rows = await db
    .select({ id: campaignInfluencers.id })
    .from(campaignInfluencers)
    .where(
      and(
        eq(campaignInfluencers.influencerId, influencerId),
        eq(campaignInfluencers.campaignId, campaignId),
      ),
    )
    .limit(1)

  return rows.length > 0
}

/**
 * Aggregated performance totals for a single campaign.
 */
export async function getCampaignPerformanceTotals(campaignId: string) {
  const rows = await db
    .select({
      totalViews: sql<number>`COALESCE(SUM(${campaignPerformance.views}), 0)`,
      totalLikes: sql<number>`COALESCE(SUM(${campaignPerformance.likes}), 0)`,
      totalComments: sql<number>`COALESCE(SUM(${campaignPerformance.comments}), 0)`,
      totalShares: sql<number>`COALESCE(SUM(${campaignPerformance.shares}), 0)`,
      totalSaves: sql<number>`COALESCE(SUM(${campaignPerformance.saves}), 0)`,
      totalClicks: sql<number>`COALESCE(SUM(${campaignPerformance.clicks}), 0)`,
      totalReach: sql<number>`COALESCE(SUM(${campaignPerformance.reach}), 0)`,
      totalImpressions: sql<number>`COALESCE(SUM(${campaignPerformance.impressions}), 0)`,
      totalIcpMatchedViewers: sql<number>`COALESCE(SUM(${campaignPerformance.icpMatchedViewers}), 0)`,
    })
    .from(campaignPerformance)
    .where(eq(campaignPerformance.campaignId, campaignId))

  const r = rows[0]
  return {
    totalViews: Number(r?.totalViews ?? 0),
    totalLikes: Number(r?.totalLikes ?? 0),
    totalComments: Number(r?.totalComments ?? 0),
    totalShares: Number(r?.totalShares ?? 0),
    totalSaves: Number(r?.totalSaves ?? 0),
    totalClicks: Number(r?.totalClicks ?? 0),
    totalReach: Number(r?.totalReach ?? 0),
    totalImpressions: Number(r?.totalImpressions ?? 0),
    totalIcpMatchedViewers: Number(r?.totalIcpMatchedViewers ?? 0),
  }
}
