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

export async function transitionCampaignStatus(
  campaignId: string,
  newStatus: string,
  brandId: string
): Promise<InfluencerCampaign> {
  const campaign = await getCampaignById(campaignId)
  if (!campaign) throw new Error(`Campaign not found: ${campaignId}`)
  if (campaign.brandId !== brandId) throw new Error('Not authorized to modify this campaign')

  const allowed = VALID_TRANSITIONS[campaign.status] ?? []
  if (!allowed.includes(newStatus)) {
    throw new Error(`Cannot transition from "${campaign.status}" to "${newStatus}"`)
  }

  return updateCampaignStatus(campaignId, newStatus)
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
