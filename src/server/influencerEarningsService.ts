/**
 * Influencer Earnings Service
 *
 * Business logic layer for influencer earnings, audience analytics,
 * and per-campaign deep dives.
 *
 * - Aggregates payment data across currencies
 * - Computes engagement rates and ICP match rates
 * - Builds anonymous audience demographics from ICP match scores (proxy)
 * - Enforces min cohort size of 5 to prevent re-identification
 */

import 'server-only'

import {
  getPaymentsForInfluencer,
  getPaymentAggregates,
  getActiveCampaignCount,
  getAggregatedPerformance,
  getAudienceViaIcpMatches,
  getCampaignPerformanceTimeSeries,
  getCampaignPerformanceTotals,
  getCampaignWithBrand,
  isInfluencerInCampaign,
} from '@/db/repositories/influencerEarningsRepository'
import type { PaymentFilters } from '@/db/repositories/influencerEarningsRepository'

// ── Constants ─────────────────────────────────────────────────────

const MIN_COHORT_SIZE = 5

// ── Types ─────────────────────────────────────────────────────────

export interface EarningsSummary {
  aggregates: Array<{
    currency: string
    released: number
    escrowed: number
    pending: number
    refunded: number
    thisMonth: number
  }>
  activeCampaigns: number
  engagementRate: number      // percentage
  icpMatchRate: number        // percentage
  performance: {
    totalViews: number
    totalLikes: number
    totalComments: number
    totalShares: number
    totalSaves: number
    totalClicks: number
    totalReach: number
    totalImpressions: number
    totalIcpMatchedViewers: number
  }
  payments: Array<{
    id: string
    campaignId: string
    campaignTitle: string
    brandId: string
    productId: string | null
    milestoneId: string | null
    milestoneTitle: string | null
    amount: number
    currency: string
    paymentType: string
    status: string
    platformFee: number
    escrowedAt: string | null
    releasedAt: string | null
    refundedAt: string | null
    createdAt: string
  }>
}

export interface AudienceAnalytics {
  totalMatched: number
  cohortMet: boolean           // true if >= MIN_COHORT_SIZE
  icpMatchRate: number
  geography: Array<{ name: string; count: number }>
  ageDistribution: Array<{ range: string; count: number }>
  genderSplit: Array<{ gender: string; count: number }>
  topInterests: Array<{ category: string; count: number }>
  engagementTiers: Array<{ tier: string; count: number }>
  deviceBreakdown: Array<{ device: string; count: number }>   // placeholder
  peakHours: Array<{ hour: number; engagement: number }>       // from performance
}

export interface CampaignDeepDive {
  campaign: {
    id: string
    title: string
    brandName: string | null
    status: string
    budgetTotal: number
    budgetCurrency: string
    startDate: string | null
    endDate: string | null
    targetPlatforms: string[]
  }
  totals: {
    views: number
    likes: number
    comments: number
    shares: number
    saves: number
    clicks: number
    reach: number
    impressions: number
    icpMatchedViewers: number
    engagementRate: number
    icpMatchRate: number
  }
  timeSeries: Array<{
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
  }>
}

// ── Helpers ──────────────────────────────────────────────────────

function calcEngagementRate(
  likes: number, comments: number, shares: number, saves: number, views: number,
): number {
  if (views === 0) return 0
  return Math.round(((likes + comments + shares + saves) / views) * 10000) / 100
}

function calcIcpMatchRate(matched: number, total: number): number {
  if (total === 0) return 0
  return Math.round((matched / total) * 10000) / 100
}

function classifyEngagementTier(score: number | undefined): string {
  if (score == null) return 'New'
  if (score >= 80) return 'Power'
  if (score >= 50) return 'Active'
  if (score >= 20) return 'Casual'
  return 'New'
}

// ── Service Methods ─────────────────────────────────────────────

export async function getEarningsSummary(
  influencerId: string,
  filters: PaymentFilters = {},
): Promise<EarningsSummary> {
  const [payments, aggregates, activeCampaigns, performance] = await Promise.all([
    getPaymentsForInfluencer(influencerId, filters),
    getPaymentAggregates(influencerId),
    getActiveCampaignCount(influencerId),
    getAggregatedPerformance(influencerId),
  ])

  const engagementRate = calcEngagementRate(
    performance.totalLikes,
    performance.totalComments,
    performance.totalShares,
    performance.totalSaves,
    performance.totalViews,
  )

  const icpMatchRate = calcIcpMatchRate(
    performance.totalIcpMatchedViewers,
    performance.totalViews,
  )

  return {
    aggregates,
    activeCampaigns,
    engagementRate,
    icpMatchRate,
    performance,
    payments: payments.map(p => ({
      ...p,
      escrowedAt: p.escrowedAt?.toISOString() ?? null,
      releasedAt: p.releasedAt?.toISOString() ?? null,
      refundedAt: p.refundedAt?.toISOString() ?? null,
      createdAt: p.createdAt.toISOString(),
    })),
  }
}

export async function getAudienceAnalytics(
  influencerId: string,
): Promise<AudienceAnalytics> {
  const [audience, performance] = await Promise.all([
    getAudienceViaIcpMatches(influencerId, 50),
    getAggregatedPerformance(influencerId),
  ])

  const icpMatchRate = calcIcpMatchRate(
    performance.totalIcpMatchedViewers,
    performance.totalViews,
  )

  const cohortMet = audience.totalMatched >= MIN_COHORT_SIZE

  // If cohort too small, return empty aggregates
  if (!cohortMet) {
    return {
      totalMatched: audience.totalMatched,
      cohortMet: false,
      icpMatchRate,
      geography: [],
      ageDistribution: [],
      genderSplit: [],
      topInterests: [],
      engagementTiers: [],
      deviceBreakdown: [],
      peakHours: [],
    }
  }

  // Aggregate demographics
  const geoMap = new Map<string, number>()
  const ageMap = new Map<string, number>()
  const genderMap = new Map<string, number>()
  const interestMap = new Map<string, number>()
  const tierMap = new Map<string, number>()

  for (const d of audience.demographics) {
    // Geography
    const loc = d.location ?? 'Unknown'
    geoMap.set(loc, (geoMap.get(loc) ?? 0) + 1)

    // Age
    const age = d.ageRange ?? 'Unknown'
    ageMap.set(age, (ageMap.get(age) ?? 0) + 1)

    // Gender
    const gender = d.gender ?? 'Unknown'
    genderMap.set(gender, (genderMap.get(gender) ?? 0) + 1)

    // Interests — flatten productCategories + topics
    if (d.interests) {
      const categories = (d.interests as any)?.productCategories
      if (Array.isArray(categories)) {
        for (const cat of categories) {
          interestMap.set(cat, (interestMap.get(cat) ?? 0) + 1)
        }
      }
      const topics = (d.interests as any)?.topics
      if (Array.isArray(topics)) {
        for (const topic of topics) {
          interestMap.set(topic, (interestMap.get(topic) ?? 0) + 1)
        }
      }
    }

    // Engagement tier from behavioral.engagementScore
    const engScore = d.behavioral?.engagementScore
    const tier = classifyEngagementTier(engScore)
    tierMap.set(tier, (tierMap.get(tier) ?? 0) + 1)
  }

  const sortByCount = (map: Map<string, number>) =>
    Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])

  // Peak hours — aggregate from campaign performance time series
  // Since we don't have hour-level data (only metricDate), return placeholder
  const peakHours: Array<{ hour: number; engagement: number }> = []

  return {
    totalMatched: audience.totalMatched,
    cohortMet: true,
    icpMatchRate,
    geography: sortByCount(geoMap).slice(0, 10).map(([name, count]) => ({ name, count })),
    ageDistribution: sortByCount(ageMap).map(([range, count]) => ({ range, count })),
    genderSplit: sortByCount(genderMap).map(([gender, count]) => ({ gender, count })),
    topInterests: sortByCount(interestMap).slice(0, 15).map(([category, count]) => ({ category, count })),
    engagementTiers: sortByCount(tierMap).map(([tier, count]) => ({ tier, count })),
    deviceBreakdown: [],  // Viewer-level device tracking not yet available
    peakHours,
  }
}

export async function getCampaignDeepDiveData(
  influencerId: string,
  campaignId: string,
): Promise<CampaignDeepDive | null> {
  // Verify access
  const hasAccess = await isInfluencerInCampaign(influencerId, campaignId)
  if (!hasAccess) return null

  const [campaign, totals, timeSeries] = await Promise.all([
    getCampaignWithBrand(campaignId),
    getCampaignPerformanceTotals(campaignId),
    getCampaignPerformanceTimeSeries(campaignId),
  ])

  if (!campaign) return null

  const engagementRate = calcEngagementRate(
    totals.totalLikes, totals.totalComments, totals.totalShares, totals.totalSaves, totals.totalViews,
  )
  const icpMatchRate = calcIcpMatchRate(totals.totalIcpMatchedViewers, totals.totalViews)

  return {
    campaign: {
      id: campaign.id,
      title: campaign.title,
      brandName: campaign.brandName,
      status: campaign.status,
      budgetTotal: campaign.budgetTotal,
      budgetCurrency: campaign.budgetCurrency,
      startDate: campaign.startDate,
      endDate: campaign.endDate,
      targetPlatforms: campaign.targetPlatforms ?? [],
    },
    totals: {
      views: totals.totalViews,
      likes: totals.totalLikes,
      comments: totals.totalComments,
      shares: totals.totalShares,
      saves: totals.totalSaves,
      clicks: totals.totalClicks,
      reach: totals.totalReach,
      impressions: totals.totalImpressions,
      icpMatchedViewers: totals.totalIcpMatchedViewers,
      engagementRate,
      icpMatchRate,
    },
    timeSeries,
  }
}
