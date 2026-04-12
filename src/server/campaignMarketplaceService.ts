/**
 * Campaign Marketplace Service
 *
 * Business logic for the influencer campaign marketplace:
 * - Browse public campaigns with filters
 * - Smart recommendations based on niche + ICP
 * - Application lifecycle (apply, withdraw, brand respond)
 * - Real-time notifications on application events
 */

import 'server-only'

import {
  getPublicCampaigns,
  getRecommendedCampaigns as getRecommendedCampaignsRepo,
  getCampaignMarketplaceDetail,
  createApplication,
  getApplicationsForInfluencer,
  getApplicationsForCampaign,
  updateApplicationStatus,
  withdrawApplication as withdrawApplicationRepo,
  getApplicationCount,
  getIcpMatchScore,
  getIcpMatchScoresBulk,
  type MarketplaceFilters,
  type MarketplaceCampaign,
} from '@/db/repositories/campaignMarketplaceRepository'
import { getCampaignById } from '@/db/repositories/influencerCampaignRepository'
import { getProfileByUserId } from '@/db/repositories/influencerProfileRepository'
import { emit, PLATFORM_EVENTS } from '@/server/eventBus'

// ── Types ─────────────────────────────────────────────────────────

export interface MarketplaceCampaignWithMatch extends MarketplaceCampaign {
  icpMatchScore: number | null   // null = no ICP or no score
  hasApplied: boolean
}

// ── Browse marketplace ──────────────────────────────────────────

export async function getMarketplaceCampaigns(
  influencerId: string,
  filters: MarketplaceFilters
): Promise<{ campaigns: MarketplaceCampaignWithMatch[]; total: number; page: number; pageSize: number }> {
  const { campaigns, total } = await getPublicCampaigns(filters)

  // Get existing applications for this influencer
  const myApps = await getApplicationsForInfluencer(influencerId)
  const appliedCampaignIds = new Set(myApps.map(a => a.campaignId))

  // Bulk-fetch ICP match scores for campaigns that have icpId
  const icpPairs = campaigns
    .filter(c => c.icpId)
    .map(c => ({ icpId: c.icpId!, consumerId: influencerId }))
  const icpScores = await getIcpMatchScoresBulk(icpPairs)

  const enriched: MarketplaceCampaignWithMatch[] = campaigns.map(c => ({
    ...c,
    icpMatchScore: c.icpId ? (icpScores.get(`${c.icpId}:${influencerId}`) ?? null) : null,
    hasApplied: appliedCampaignIds.has(c.id),
  }))

  // If sort is 'best_match', re-sort by ICP score descending (nulls last)
  if (filters.sortBy === 'deadline_soon') {
    // Already sorted by DB
  }

  return {
    campaigns: enriched,
    total,
    page: filters.page ?? 1,
    pageSize: filters.pageSize ?? 12,
  }
}

// ── Recommended campaigns ───────────────────────────────────────

export async function getRecommendedCampaigns(influencerId: string) {
  const campaigns = await getRecommendedCampaignsRepo(influencerId, 6)

  // Enrich with ICP scores
  const icpPairs = campaigns
    .filter(c => c.icpId)
    .map(c => ({ icpId: c.icpId!, consumerId: influencerId }))
  const icpScores = await getIcpMatchScoresBulk(icpPairs)

  return campaigns.map(c => ({
    ...c,
    icpMatchScore: c.icpId ? (icpScores.get(`${c.icpId}:${influencerId}`) ?? null) : null,
    hasApplied: false, // Recommended excludes already-applied
  }))
}

// ── Campaign detail ─────────────────────────────────────────────

export async function getMarketplaceCampaignDetail(campaignId: string, influencerId: string) {
  const result = await getCampaignMarketplaceDetail(campaignId, influencerId)
  if (!result.campaign) return result

  // Add ICP match score
  let icpMatchScore: number | null = null
  if (result.campaign.icpId) {
    icpMatchScore = await getIcpMatchScore(result.campaign.icpId, influencerId)
  }

  return {
    ...result,
    campaign: { ...result.campaign, icpMatchScore },
  }
}

// ── Apply to campaign ───────────────────────────────────────────

export async function applyToCampaign(
  influencerId: string,
  campaignId: string,
  proposal: { proposalText: string; proposedRate: number; proposedCurrency: string }
) {
  // Validate proposal text length
  if (!proposal.proposalText || proposal.proposalText.length < 50) {
    throw new Error('Proposal must be at least 50 characters')
  }
  if (!proposal.proposedRate || proposal.proposedRate <= 0) {
    throw new Error('Proposed rate must be positive')
  }

  // Get campaign and validate
  const campaign = await getCampaignById(campaignId)
  if (!campaign) throw new Error('Campaign not found')
  if (!campaign.isPublic) throw new Error('Campaign is not accepting public applications')
  if (!['draft', 'proposed', 'active'].includes(campaign.status)) {
    throw new Error('Campaign is no longer accepting applications')
  }

  // Check application deadline
  if (campaign.applicationDeadline) {
    const deadline = new Date(campaign.applicationDeadline)
    if (new Date() > deadline) throw new Error('Application deadline has passed')
  }

  // Check max influencers
  if (campaign.maxInfluencers) {
    const currentCount = await getApplicationCount(campaignId)
    if (currentCount >= campaign.maxInfluencers) {
      throw new Error('This campaign has reached its maximum number of applications')
    }
  }

  // Verify influencer profile exists
  const profile = await getProfileByUserId(influencerId)
  if (!profile) throw new Error('Please complete your influencer profile first')

  // Create application (UNIQUE constraint catches duplicates)
  let application
  try {
    application = await createApplication({
      campaignId,
      influencerId,
      proposalText: proposal.proposalText,
      proposedRate: proposal.proposedRate,
      proposedCurrency: proposal.proposedCurrency,
    })
  } catch (err: any) {
    if (err?.code === '23505') throw new Error('You have already applied to this campaign')
    throw err
  }

  // Emit real-time event to brand
  emit(PLATFORM_EVENTS.INFLUENCER_CAMPAIGN_APPLIED, {
    brandId: campaign.brandId,
    campaignId: campaign.id,
    campaignTitle: campaign.title,
    influencerId,
    influencerName: profile.displayName ?? 'An influencer',
    proposedRate: proposal.proposedRate,
    proposalPreview: proposal.proposalText.slice(0, 100),
  }).catch(() => {})

  return application
}

// ── Brand respond to application ────────────────────────────────

export async function respondToApplication(
  brandId: string,
  applicationId: string,
  status: 'accepted' | 'rejected',
  response: string | null
) {
  const result = await updateApplicationStatus(applicationId, status, response, brandId)
  if (result.error) throw new Error(result.error)
  if (!result.application) throw new Error('Failed to update application')

  const app = result.application
  const campaign = await getCampaignById(app.campaignId)

  if (status === 'accepted') {
    emit(PLATFORM_EVENTS.BRAND_APPLICATION_ACCEPTED, {
      influencerId: app.influencerId,
      campaignId: app.campaignId,
      campaignTitle: campaign?.title ?? 'a campaign',
      brandId,
      brandName: undefined, // Will be resolved in eventBus if needed
    }).catch(() => {})
  } else {
    emit(PLATFORM_EVENTS.BRAND_APPLICATION_REJECTED, {
      influencerId: app.influencerId,
      campaignId: app.campaignId,
      campaignTitle: campaign?.title ?? 'a campaign',
      brandId,
      brandResponse: response,
    }).catch(() => {})
  }

  return result.application
}

// ── Withdraw ────────────────────────────────────────────────────

export async function withdrawApplicationService(applicationId: string, influencerId: string) {
  return withdrawApplicationRepo(applicationId, influencerId)
}

// ── Re-exports for API routes ───────────────────────────────────

export { getApplicationsForInfluencer, getApplicationsForCampaign }
