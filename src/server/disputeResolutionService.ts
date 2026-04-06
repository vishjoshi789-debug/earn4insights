/**
 * Dispute Resolution Service
 *
 * Manages the dispute lifecycle for influencer campaigns.
 * Either party (brand or influencer) can raise a dispute.
 * Admins resolve disputes.
 */

import 'server-only'

import {
  createDispute,
  getDisputeById,
  getDisputesByCampaign,
  getDisputesByStatus,
  resolveDispute,
  updateDisputeStatus,
} from '@/db/repositories/campaignDisputeRepository'
import { getCampaignById, updateCampaignStatus } from '@/db/repositories/influencerCampaignRepository'
import { getInvitation } from '@/db/repositories/campaignInfluencerRepository'
import type { CampaignDispute } from '@/db/schema'

// ── Raise dispute ────────────────────────────────────────────────

export async function raiseDispute(
  campaignId: string,
  raisedBy: string,
  data: { reason: string; evidence?: string[] }
): Promise<CampaignDispute> {
  const campaign = await getCampaignById(campaignId)
  if (!campaign) throw new Error('Campaign not found')

  // Verify the user is either the brand or an invited influencer
  const isBrand = campaign.brandId === raisedBy
  if (!isBrand) {
    const invitation = await getInvitation(campaignId, raisedBy)
    if (!invitation || invitation.status === 'rejected') {
      throw new Error('Not authorized to raise a dispute for this campaign')
    }
  }

  // Only active or completed campaigns can have disputes
  if (!['active', 'completed', 'disputed'].includes(campaign.status)) {
    throw new Error(`Cannot raise dispute on a campaign in "${campaign.status}" status`)
  }

  const dispute = await createDispute({
    campaignId,
    raisedBy,
    reason: data.reason,
    evidence: data.evidence ?? [],
    status: 'open',
  })

  // Mark campaign as disputed if it was active
  if (campaign.status === 'active') {
    await updateCampaignStatus(campaignId, 'disputed')
  }

  return dispute
}

// ── Resolve dispute (admin) ──────────────────────────────────────

export async function resolveDisputeAsAdmin(
  disputeId: string,
  adminId: string,
  data: { resolution: string; status: 'resolved' | 'closed' }
): Promise<CampaignDispute> {
  const dispute = await getDisputeById(disputeId)
  if (!dispute) throw new Error('Dispute not found')
  if (dispute.status === 'resolved' || dispute.status === 'closed') {
    throw new Error('Dispute is already resolved')
  }

  const resolved = await resolveDispute(disputeId, {
    resolvedBy: adminId,
    resolution: data.resolution,
    status: data.status,
  })

  // If all disputes for the campaign are resolved, revert campaign to active
  const remainingDisputes = await getDisputesByCampaign(dispute.campaignId)
  const hasOpenDisputes = remainingDisputes.some(d =>
    d.id !== disputeId && (d.status === 'open' || d.status === 'under_review')
  )

  if (!hasOpenDisputes) {
    const campaign = await getCampaignById(dispute.campaignId)
    if (campaign?.status === 'disputed') {
      await updateCampaignStatus(dispute.campaignId, 'active')
    }
  }

  return resolved
}

// ── Status updates ───────────────────────────────────────────────

export async function markDisputeUnderReview(disputeId: string): Promise<void> {
  const dispute = await getDisputeById(disputeId)
  if (!dispute) throw new Error('Dispute not found')
  if (dispute.status !== 'open') throw new Error('Can only review open disputes')

  await updateDisputeStatus(disputeId, 'under_review')
}

// ── Reads ────────────────────────────────────────────────────────

export { getDisputeById, getDisputesByCampaign, getDisputesByStatus }
