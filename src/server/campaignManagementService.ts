/**
 * Campaign Management Service
 *
 * Orchestrates the full lifecycle of influencer marketing campaigns:
 *   draft → proposed → negotiating → active → completed/cancelled/disputed
 *
 * Handles:
 * - Campaign CRUD (brand side)
 * - Influencer invitations and responses
 * - Status transitions with validation
 * - Campaign summary with influencers, milestones, payments
 */

import 'server-only'

import {
  createCampaign,
  getCampaignById,
  getCampaignsByBrand,
  getCampaignsByInfluencer,
  updateCampaign,
  updateCampaignStatus,
  deleteCampaign,
} from '@/db/repositories/influencerCampaignRepository'
import {
  inviteInfluencer,
  getInfluencersByCampaign,
  getInvitation,
  updateInvitationStatus,
  removeInfluencer,
} from '@/db/repositories/campaignInfluencerRepository'
import {
  getMilestonesByCampaign,
  getTotalMilestoneAmount,
} from '@/db/repositories/campaignMilestoneRepository'
import {
  getPaymentsByCampaign,
  getTotalPaidForCampaign,
  getTotalEscrowedForCampaign,
} from '@/db/repositories/campaignPaymentRepository'
import { getProfileByUserId } from '@/db/repositories/influencerProfileRepository'
import { db } from '@/db'
import { auditLog } from '@/db/schema'
import type { InfluencerCampaign, NewInfluencerCampaign } from '@/db/schema'

// ── Types ────────────────────────────────────────────────────────

export type CampaignSummary = {
  campaign: InfluencerCampaign
  influencers: Awaited<ReturnType<typeof getInfluencersByCampaign>>
  milestones: Awaited<ReturnType<typeof getMilestonesByCampaign>>
  payments: {
    records: Awaited<ReturnType<typeof getPaymentsByCampaign>>
    totalPaid: number
    totalEscrowed: number
  }
}

// ── Valid status transitions ─────────────────────────────────────

const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ['proposed', 'cancelled'],
  proposed: ['negotiating', 'active', 'cancelled'],
  negotiating: ['active', 'cancelled'],
  active: ['completed', 'cancelled', 'disputed'],
  disputed: ['active', 'cancelled', 'completed'],
  completed: [],
  cancelled: [],
}

// ── Campaign CRUD ────────────────────────────────────────────────

export async function createNewCampaign(
  brandId: string,
  data: {
    title: string
    brief?: string
    requirements?: string
    deliverables?: string[]
    targetGeography?: string[]
    targetPlatforms?: string[]
    budgetTotal: number
    budgetCurrency?: string
    paymentType?: 'escrow' | 'milestone' | 'direct'
    startDate?: string
    endDate?: string
    productId?: string
    icpId?: string
    // Marketplace (migration 007)
    isPublic?: boolean
    maxInfluencers?: number
    applicationDeadline?: string
    // Content approval SLA (migration 006)
    reviewSlaHours?: number
    autoApproveEnabled?: boolean
  }
): Promise<InfluencerCampaign> {
  if (data.budgetTotal <= 0) {
    throw new Error('Budget must be greater than 0')
  }

  return createCampaign({
    brandId,
    title: data.title,
    brief: data.brief ?? null,
    requirements: data.requirements ?? null,
    deliverables: data.deliverables ?? [],
    targetGeography: data.targetGeography ?? [],
    targetPlatforms: data.targetPlatforms ?? [],
    budgetTotal: data.budgetTotal,
    budgetCurrency: data.budgetCurrency ?? 'INR',
    paymentType: data.paymentType ?? 'escrow',
    startDate: data.startDate ?? null,
    endDate: data.endDate ?? null,
    productId: data.productId ?? null,
    icpId: data.icpId ?? null,
    status: 'draft',
    isPublic: data.isPublic ?? false,
    maxInfluencers: data.maxInfluencers ?? null,
    applicationDeadline: data.applicationDeadline ?? null,
    reviewSlaHours: data.reviewSlaHours ?? null,
    autoApproveEnabled: data.autoApproveEnabled ?? false,
  })
}

export async function getCampaignSummary(campaignId: string): Promise<CampaignSummary | null> {
  const campaign = await getCampaignById(campaignId)
  if (!campaign) return null

  const [influencers, milestones, payments, totalPaid, totalEscrowed] = await Promise.all([
    getInfluencersByCampaign(campaignId),
    getMilestonesByCampaign(campaignId),
    getPaymentsByCampaign(campaignId),
    getTotalPaidForCampaign(campaignId),
    getTotalEscrowedForCampaign(campaignId),
  ])

  return {
    campaign,
    influencers,
    milestones,
    payments: { records: payments, totalPaid, totalEscrowed },
  }
}

export { getCampaignsByBrand, getCampaignsByInfluencer }

// ── Status transitions ───────────────────────────────────────────

/**
 * Required fields a campaign must populate before it can leave the
 * 'draft' state. The wizard / detail UI mirrors this list so brands
 * see "complete these to publish: title, budget, brief" inline before
 * the click. Stripe pattern — fail fast, list what's missing.
 *
 * Q4 (3C plan): minimum viable — title + budget + brief.
 */
function getMissingPublishFields(campaign: InfluencerCampaign): string[] {
  const missing: string[] = []
  if (!campaign.title || campaign.title.trim() === '') missing.push('title')
  if (!campaign.budgetTotal || campaign.budgetTotal <= 0) missing.push('budget')
  if (!campaign.brief || campaign.brief.trim() === '') missing.push('brief')
  return missing
}

/**
 * Validate + perform a status transition, then write an audit_log row.
 * cancelReason is passed through to the audit metadata when present
 * (cancellations are the highest-stakes transition — influencers may
 * be mid-work, milestones may be escrowed).
 */
export async function transitionCampaignStatus(
  campaignId: string,
  newStatus: string,
  brandId: string,
  opts: { cancelReason?: string } = {},
): Promise<InfluencerCampaign> {
  const campaign = await getCampaignById(campaignId)
  if (!campaign) throw new Error(`Campaign not found: ${campaignId}`)
  if (campaign.brandId !== brandId) throw new Error('Not authorized to modify this campaign')

  const allowed = VALID_TRANSITIONS[campaign.status] ?? []
  if (!allowed.includes(newStatus)) {
    throw new Error(`Cannot transition from "${campaign.status}" to "${newStatus}"`)
  }

  // Pre-publish required-field validation. Fires on draft → proposed
  // (the actual "publish" moment that makes the campaign visible in
  // the marketplace). Subsequent transitions (negotiating → active
  // etc.) don't re-validate — by the time the campaign is past draft,
  // the brand has had ample chance to fill in details.
  if (campaign.status === 'draft' && newStatus === 'proposed') {
    const missing = getMissingPublishFields(campaign)
    if (missing.length > 0) {
      throw new Error(`Complete these fields to publish: ${missing.join(', ')}`)
    }
  }

  const updated = await updateCampaignStatus(campaignId, newStatus)

  // Audit log — every transition. Captures who, when, what state move,
  // and any reason metadata. Useful for investigating cancellations
  // (when payments are involved) and for compliance trails.
  await db.insert(auditLog).values({
    userId: brandId,
    action: 'campaign_status_transition',
    dataType: 'influencer_campaign',
    accessedBy: brandId,
    metadata: {
      campaignId,
      fromStatus: campaign.status,
      toStatus: newStatus,
      cancelReason: opts.cancelReason ?? null,
      campaignTitle: campaign.title,
      budgetTotal: campaign.budgetTotal,
    },
    reason:
      newStatus === 'cancelled' && opts.cancelReason
        ? `Cancelled: ${opts.cancelReason.slice(0, 200)}`
        : `Status moved ${campaign.status} → ${newStatus}`,
  })

  return updated
}

/**
 * Helper exposed for the campaign detail page client component so the
 * UI can preview what's missing BEFORE the user clicks Publish — same
 * source of truth as the server validation above.
 */
export async function getCampaignPublishability(
  campaignId: string,
  brandId: string,
): Promise<{ ready: boolean; missing: string[] }> {
  const campaign = await getCampaignById(campaignId)
  if (!campaign) throw new Error(`Campaign not found: ${campaignId}`)
  if (campaign.brandId !== brandId) throw new Error('Not authorized to view this campaign')
  const missing = getMissingPublishFields(campaign)
  return { ready: missing.length === 0, missing }
}

export async function updateCampaignDetails(
  campaignId: string,
  brandId: string,
  data: Parameters<typeof updateCampaign>[1]
): Promise<InfluencerCampaign> {
  const campaign = await getCampaignById(campaignId)
  if (!campaign) throw new Error(`Campaign not found: ${campaignId}`)
  if (campaign.brandId !== brandId) throw new Error('Not authorized to modify this campaign')

  if (campaign.status !== 'draft' && campaign.status !== 'proposed') {
    throw new Error('Can only edit campaigns in draft or proposed status')
  }

  return updateCampaign(campaignId, data)
}

export async function removeCampaign(campaignId: string, brandId: string): Promise<void> {
  const campaign = await getCampaignById(campaignId)
  if (!campaign) throw new Error(`Campaign not found: ${campaignId}`)
  if (campaign.brandId !== brandId) throw new Error('Not authorized')
  if (campaign.status !== 'draft') throw new Error('Can only delete draft campaigns')

  await deleteCampaign(campaignId)
}

// ── Influencer invitations ───────────────────────────────────────

export async function inviteInfluencerToCampaign(
  campaignId: string,
  influencerId: string,
  brandId: string,
  opts?: { deliverables?: string[]; agreedRate?: number }
): Promise<void> {
  const campaign = await getCampaignById(campaignId)
  if (!campaign) throw new Error(`Campaign not found: ${campaignId}`)
  if (campaign.brandId !== brandId) throw new Error('Not authorized')

  // Verify influencer has a profile
  const profile = await getProfileByUserId(influencerId)
  if (!profile || !profile.isActive) throw new Error('Influencer profile not found or inactive')

  // Check not already invited
  const existing = await getInvitation(campaignId, influencerId)
  if (existing) throw new Error('Influencer already invited to this campaign')

  await inviteInfluencer({
    campaignId,
    influencerId,
    deliverables: opts?.deliverables,
    agreedRate: opts?.agreedRate,
  })
}

export async function respondToInvitation(
  campaignId: string,
  influencerId: string,
  accept: boolean,
  agreedRate?: number
): Promise<void> {
  const invitation = await getInvitation(campaignId, influencerId)
  if (!invitation) throw new Error('Invitation not found')
  if (invitation.status !== 'invited') throw new Error('Invitation already responded to')

  if (accept) {
    await updateInvitationStatus(campaignId, influencerId, 'accepted', {
      acceptedAt: new Date(),
      agreedRate,
    })
  } else {
    await updateInvitationStatus(campaignId, influencerId, 'rejected')
  }
}

export async function markInfluencerComplete(
  campaignId: string,
  influencerId: string,
  brandId: string
): Promise<void> {
  const campaign = await getCampaignById(campaignId)
  if (!campaign) throw new Error('Campaign not found')
  if (campaign.brandId !== brandId) throw new Error('Not authorized')

  await updateInvitationStatus(campaignId, influencerId, 'completed', {
    completedAt: new Date(),
  })
}

export async function removeInfluencerFromCampaign(
  campaignId: string,
  influencerId: string,
  brandId: string
): Promise<void> {
  const campaign = await getCampaignById(campaignId)
  if (!campaign) throw new Error('Campaign not found')
  if (campaign.brandId !== brandId) throw new Error('Not authorized')

  await removeInfluencer(campaignId, influencerId)
}
