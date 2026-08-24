/**
 * Campaign Payment Service
 *
 * Manages milestone-based and escrow payment flows for influencer campaigns.
 * Integrates with Razorpay (payment gateway) for actual fund movement.
 *
 * Payment flow:
 *   1. Brand creates campaign → milestones defined
 *   2. Brand escrows funds for a milestone
 *   3. Influencer submits deliverable → milestone marked submitted
 *   4. Brand approves milestone → payment released from escrow
 *
 * Platform fee is calculated at escrow time based on campaign.platformFeePct.
 */

import 'server-only'

import {
  createMilestone,
  getMilestoneById,
  getMilestonesByCampaign,
  updateMilestoneStatus,
  getTotalMilestoneAmount,
  deleteMilestone,
} from '@/db/repositories/campaignMilestoneRepository'
import {
  // createPayment intentionally NOT imported here any more — the only user was
  // escrowForMilestone. The ledger row is written by razorpayService.createOrder,
  // where a real Razorpay order backs it.
  getPaymentsByCampaign,
  getPaymentByMilestone,
  updatePaymentStatus,
  getTotalPaidForCampaign,
  getTotalEscrowedForCampaign,
} from '@/db/repositories/campaignPaymentRepository'
import { getCampaignById } from '@/db/repositories/influencerCampaignRepository'
import type { CampaignMilestone, CampaignPayment } from '@/db/schema'

// ── Milestone management ────────────────────────��────────────────

export async function addMilestone(
  campaignId: string,
  brandId: string,
  data: {
    title: string
    description?: string
    dueDate?: string
    paymentAmount: number
    sortOrder?: number
  }
): Promise<CampaignMilestone> {
  const campaign = await getCampaignById(campaignId)
  if (!campaign) throw new Error('Campaign not found')
  if (campaign.brandId !== brandId) throw new Error('Not authorized')

  if (data.paymentAmount <= 0) {
    throw new Error('Payment amount must be greater than 0')
  }

  // Validate total milestones don't exceed budget
  const currentTotal = await getTotalMilestoneAmount(campaignId)
  if (currentTotal + data.paymentAmount > campaign.budgetTotal) {
    throw new Error(
      `Milestone total (${currentTotal + data.paymentAmount}) would exceed campaign budget (${campaign.budgetTotal})`
    )
  }

  return createMilestone({
    campaignId,
    title: data.title,
    description: data.description ?? null,
    dueDate: data.dueDate ?? null,
    paymentAmount: data.paymentAmount,
    sortOrder: data.sortOrder ?? 0,
  })
}

export async function submitMilestone(milestoneId: string, influencerId: string): Promise<CampaignMilestone> {
  const milestone = await getMilestoneById(milestoneId)
  if (!milestone) throw new Error('Milestone not found')
  if (milestone.status !== 'pending' && milestone.status !== 'in_progress' && milestone.status !== 'rejected') {
    throw new Error(`Cannot submit milestone in "${milestone.status}" status`)
  }

  return updateMilestoneStatus(milestoneId, 'submitted', { completedAt: new Date() })
}

export async function approveMilestone(
  milestoneId: string,
  brandId: string
): Promise<{ milestone: CampaignMilestone; payment?: CampaignPayment }> {
  const milestone = await getMilestoneById(milestoneId)
  if (!milestone) throw new Error('Milestone not found')

  const campaign = await getCampaignById(milestone.campaignId)
  if (!campaign) throw new Error('Campaign not found')
  if (campaign.brandId !== brandId) throw new Error('Not authorized')
  if (milestone.status !== 'submitted') throw new Error('Milestone must be submitted before approval')

  const updatedMilestone = await updateMilestoneStatus(milestoneId, 'approved', {
    approvedAt: new Date(),
    approvedBy: brandId,
  })

  // Auto-release escrowed payment if exists
  const existingPayment = await getPaymentByMilestone(milestoneId)
  let payment: CampaignPayment | undefined
  if (existingPayment && existingPayment.status === 'escrowed') {
    payment = await updatePaymentStatus(existingPayment.id, 'released', {
      releasedAt: new Date(),
    })
  }

  return { milestone: updatedMilestone, payment }
}

export async function rejectMilestone(milestoneId: string, brandId: string): Promise<CampaignMilestone> {
  const milestone = await getMilestoneById(milestoneId)
  if (!milestone) throw new Error('Milestone not found')

  const campaign = await getCampaignById(milestone.campaignId)
  if (!campaign) throw new Error('Campaign not found')
  if (campaign.brandId !== brandId) throw new Error('Not authorized')
  if (milestone.status !== 'submitted') throw new Error('Can only reject submitted milestones')

  return updateMilestoneStatus(milestoneId, 'rejected')
}

export async function removeMilestone(milestoneId: string, brandId: string): Promise<void> {
  const milestone = await getMilestoneById(milestoneId)
  if (!milestone) throw new Error('Milestone not found')

  const campaign = await getCampaignById(milestone.campaignId)
  if (!campaign) throw new Error('Campaign not found')
  if (campaign.brandId !== brandId) throw new Error('Not authorized')
  if (milestone.status !== 'pending') throw new Error('Can only delete pending milestones')

  await deleteMilestone(milestoneId)
}

// ── Escrow payments ──────────────────────────────────────────────
//
// ⚠️⚠️ `escrowForMilestone()` WAS HERE AND WAS DELETED (Phase 1, 2026-08-24).
// THIS DID NOT REMOVE ESCROW. Escrow is Razorpay holding the funds PLUS a
// campaign_payments row recording that hold. Both still exist; the second one
// started working for the first time in this same change. What was deleted is
// a pre-Razorpay artifact that would have written FALSE ledger entries.
//
// It had zero callers anywhere in the codebase, and three independent defects:
//
//   1. It wrote status:'escrowed' with NO MONEY HAVING MOVED. Wiring it up
//      would have made the ledger assert funds were held that Razorpay never
//      took — worse than an empty table, because an empty table is honestly
//      empty.
//   2. It never set `influencerAmount`, which is the column process-payouts
//      actually pays out — so a row it created would have produced a NULL
//      payout.
//   3. It computed fees from `campaign.platformFeePct` while createOrder uses
//      FEE_SCHEDULE — two disagreeing sources of truth for the same number.
//
// The ledger row is now written by `createOrder` in razorpayService (status
// 'pending', at order creation) and claimed to 'escrowed' by capture or the
// Razorpay webhook, whichever wins. That is the only writer, and money has
// provably moved before it says 'escrowed'.

// ── Payment summary ───────────────────────────────��──────────────

export async function getCampaignPaymentSummary(campaignId: string) {
  const [payments, totalPaid, totalEscrowed, milestones, totalMilestoneAmount] = await Promise.all([
    getPaymentsByCampaign(campaignId),
    getTotalPaidForCampaign(campaignId),
    getTotalEscrowedForCampaign(campaignId),
    getMilestonesByCampaign(campaignId),
    getTotalMilestoneAmount(campaignId),
  ])

  const campaign = await getCampaignById(campaignId)

  return {
    payments,
    milestones,
    totalPaid,
    totalEscrowed,
    totalMilestoneAmount,
    budgetTotal: campaign?.budgetTotal ?? 0,
    budgetRemaining: (campaign?.budgetTotal ?? 0) - totalMilestoneAmount,
  }
}
