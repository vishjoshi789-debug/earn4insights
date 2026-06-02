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
  acceptApplicationAtomic,
  withdrawApplication as withdrawApplicationRepo,
  getApplicationCount,
  getIcpMatchScore,
  getIcpMatchScoresBulk,
  type MarketplaceFilters,
  type MarketplaceCampaign,
} from '@/db/repositories/campaignMarketplaceRepository'
import { getCampaignById } from '@/db/repositories/influencerCampaignRepository'
import { getProfileByUserId } from '@/db/repositories/influencerProfileRepository'
import { hasPayoutAccount } from '@/db/repositories/payoutAccountRepository'
import { PayoutAccountRequiredError } from '@/server/payoutService'
import { db } from '@/db'
import { auditLog } from '@/db/schema'
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
  // A13 — drafts are still being edited by the brand and must not
  // accept applications. Split the error from the general allowlist
  // miss so the influencer sees the accurate reason ("not yet open"
  // for drafts vs "no longer accepting" for completed/cancelled).
  if (campaign.status === 'draft') {
    throw new Error('This campaign is not yet open for applications')
  }
  if (!['proposed', 'active'].includes(campaign.status)) {
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

  // A10 L4 — hard guard: influencer must have a payout account
  // matching the campaign's currency before applying. Same logic as
  // L3 in respondToInvitation but the marketplace path. Applying is
  // an earning intent — better to gate at the door than at brand
  // payment release where the failure shows up to the brand instead
  // of the influencer.
  const payoutOk = await hasPayoutAccount(influencerId, 'influencer', campaign.budgetCurrency)
  if (!payoutOk) {
    await db.insert(auditLog).values({
      userId: influencerId,
      action: 'apply_blocked_no_payout',
      dataType: 'campaign_application',
      accessedBy: influencerId,
      metadata: {
        campaignId,
        campaignTitle: campaign.title,
        currency: campaign.budgetCurrency,
      },
      reason: `Apply blocked — no payout account for ${campaign.budgetCurrency}`,
    })
    throw new PayoutAccountRequiredError(campaign.budgetCurrency)
  }

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
//
// Accept and reject take very different code paths:
//
//   ACCEPT   → acceptApplicationAtomic() runs both writes in one tx:
//              flip campaign_applications.status + insert/reconcile
//              the campaign_influencers membership row. Until this
//              fix shipped, the missing membership row silently broke
//              payment release, dispute, reviews, and influencer
//              "My Campaigns" — see audit Pass 2 C1 / Pass 3 I-C1.
//
//   REJECT   → single-row UPDATE; no membership writes needed.
//
// Both paths emit their notification events POST-commit so a Pusher
// outage cannot leave the DB in a half-applied state.

export async function respondToApplication(
  brandId: string,
  applicationId: string,
  status: 'accepted' | 'rejected',
  response: string | null
) {
  if (status === 'accepted') {
    // Atomic accept — throws on validation / ownership failure.
    // Translate thrown messages to the same shape the old call returned
    // so the API route's existing error-mapping continues to work.
    let result
    try {
      result = await acceptApplicationAtomic(applicationId, response, brandId)
    } catch (err: any) {
      const msg = err?.message ?? 'Failed to accept application'
      throw new Error(msg)
    }

    const app = result.application
    const campaign = await getCampaignById(app.campaignId)

    // Notify the influencer that their application was accepted.
    // Skip on idempotent replay — we already notified the first time.
    if (!result.alreadyAccepted) {
      emit(PLATFORM_EVENTS.BRAND_APPLICATION_ACCEPTED, {
        influencerId: app.influencerId,
        campaignId: app.campaignId,
        campaignTitle: campaign?.title ?? 'a campaign',
        brandId,
        brandName: undefined, // resolved in eventBus if needed
      }).catch(() => {})

      // Notify the brand that the campaign now has a confirmed influencer
      // member — mirrors what fires in the manual-invite flow when the
      // influencer accepts. Useful when the brand has multiple admins or
      // when the accepting brand wants the activity-feed entry recorded.
      emit(PLATFORM_EVENTS.INFLUENCER_CAMPAIGN_ACCEPTED, {
        brandId,
        campaignId: app.campaignId,
        campaignTitle: campaign?.title ?? 'your campaign',
        influencerId: app.influencerId,
      }).catch(() => {})
    }

    return app
  }

  // ── Reject path ───────────────────────────────────────────────
  const result = await updateApplicationStatus(applicationId, status, response, brandId)
  if (result.error) throw new Error(result.error)
  if (!result.application) throw new Error('Failed to update application')

  const app = result.application
  const campaign = await getCampaignById(app.campaignId)

  emit(PLATFORM_EVENTS.BRAND_APPLICATION_REJECTED, {
    influencerId: app.influencerId,
    campaignId: app.campaignId,
    campaignTitle: campaign?.title ?? 'a campaign',
    brandId,
    brandResponse: response,
  }).catch(() => {})

  return result.application
}

// ── Withdraw ────────────────────────────────────────────────────

export async function withdrawApplicationService(applicationId: string, influencerId: string) {
  return withdrawApplicationRepo(applicationId, influencerId)
}

// ── Re-exports for API routes ───────────────────────────────────

export { getApplicationsForInfluencer, getApplicationsForCampaign }
