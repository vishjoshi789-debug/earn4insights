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
import { getApplicationCount } from '@/db/repositories/campaignMarketplaceRepository'
import { getProfileByUserId } from '@/db/repositories/influencerProfileRepository'
import { hasPayoutAccount } from '@/db/repositories/payoutAccountRepository'
import { PayoutAccountRequiredError } from '@/server/payoutService'
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
  // 3D — surfaced so the edit dialog can warn before a brand mutates
  // budget on a campaign that has already received applications.
  applicationCount: number
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

  const [influencers, milestones, payments, totalPaid, totalEscrowed, applicationCount] = await Promise.all([
    getInfluencersByCampaign(campaignId),
    getMilestonesByCampaign(campaignId),
    getPaymentsByCampaign(campaignId),
    getTotalPaidForCampaign(campaignId),
    getTotalEscrowedForCampaign(campaignId),
    getApplicationCount(campaignId),
  ])

  return {
    campaign,
    influencers,
    milestones,
    payments: { records: payments, totalPaid, totalEscrowed },
    applicationCount,
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

// 3D — fields a brand can edit. Anything outside this allowlist is
// silently dropped on the server even if the client sends it, so a
// malicious or stale client can't move platformFeePct / brandId / etc.
const EDITABLE_FIELDS = [
  'title', 'brief', 'requirements', 'deliverables',
  'targetGeography', 'targetPlatforms',
  'budgetTotal', 'budgetCurrency', 'paymentType',
  'startDate', 'endDate', 'productId', 'icpId',
  'isPublic', 'maxInfluencers', 'applicationDeadline',
  'reviewSlaHours', 'autoApproveEnabled',
] as const

// Statuses where a brand can edit campaign details (3D, Q1).
// Active/completed/cancelled/disputed all have downstream side-effects
// (escrowed funds, accepted influencers, ledger entries) that an edit
// could blindside — those need a separate spec.
const EDITABLE_STATUSES = new Set(['draft', 'proposed', 'negotiating'])

export async function updateCampaignDetails(
  campaignId: string,
  brandId: string,
  data: Parameters<typeof updateCampaign>[1]
): Promise<InfluencerCampaign> {
  const campaign = await getCampaignById(campaignId)
  if (!campaign) throw new Error(`Campaign not found: ${campaignId}`)
  if (campaign.brandId !== brandId) throw new Error('Not authorized to modify this campaign')

  if (!EDITABLE_STATUSES.has(campaign.status)) {
    throw new Error(`Cannot edit a campaign in "${campaign.status}" status — editing is only available for draft, proposed, or negotiating campaigns.`)
  }

  // Allowlist filter — quietly drop any field the client sent that we
  // don't classify as editable. Defence-in-depth on top of the Drizzle
  // Pick<> on the repo signature.
  const filtered: Record<string, unknown> = {}
  for (const key of EDITABLE_FIELDS) {
    if (key in (data as object)) {
      filtered[key] = (data as Record<string, unknown>)[key]
    }
  }

  // Q2 — paymentType is editable on draft ONLY. Once a campaign has
  // been published (status = proposed) influencers may have applied
  // against the stated payment terms; changing them after the fact is
  // Stripe-pattern frowned-upon. Drop the field rather than throw so
  // the rest of the save still goes through.
  if ('paymentType' in filtered && campaign.status !== 'draft') {
    delete filtered.paymentType
  }

  // Compute the diff that lands in audit_log. Compare against the
  // pre-update campaign row. Arrays use shallow JSON equality which is
  // good enough for the brand-facing deliverable / platform / geography
  // lists. Dates from <input type="date"> arrive as 'YYYY-MM-DD' strings.
  const changedFields: string[] = []
  const fromValues: Record<string, unknown> = {}
  const toValues: Record<string, unknown> = {}
  for (const key of Object.keys(filtered)) {
    const before = (campaign as Record<string, unknown>)[key]
    const after = filtered[key]
    const beforeKey = JSON.stringify(before ?? null)
    const afterKey = JSON.stringify(after ?? null)
    if (beforeKey !== afterKey) {
      changedFields.push(key)
      fromValues[key] = before ?? null
      toValues[key] = after ?? null
    }
  }

  const updated = await updateCampaign(
    campaignId,
    filtered as Parameters<typeof updateCampaign>[1],
  )

  // Q5 — write an audit_log row on EVERY save, even when nothing
  // actually changed. Operational trail beats storage savings.
  await db.insert(auditLog).values({
    userId: brandId,
    action: 'campaign_details_updated',
    dataType: 'influencer_campaign',
    accessedBy: brandId,
    metadata: {
      campaignId,
      status: campaign.status,
      changedFields,
      from: fromValues,
      to: toValues,
      noOp: changedFields.length === 0,
    },
    reason: changedFields.length === 0
      ? 'No fields changed'
      : `Updated: ${changedFields.join(', ')}`,
  })

  return updated
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
    // A10 L3 — hard guard: influencer must have a payout account
    // matching the campaign's currency before accepting. The payment
    // release path checks getPrimaryAccount(userId, currency) and
    // throws PayoutAccountMissingError if absent — by which time the
    // influencer has already done the work. Catching here fails fast
    // so the influencer can fix it before any engagement begins.
    const campaign = await getCampaignById(campaignId)
    if (!campaign) throw new Error('Campaign not found')
    const ok = await hasPayoutAccount(influencerId, 'influencer', campaign.budgetCurrency)
    if (!ok) {
      // Audit blocked attempt — operational signal for support
      // ("I tried to accept and got an error"). Account creation
      // itself auto-audits via the row write in payout_accounts.
      await db.insert(auditLog).values({
        userId: influencerId,
        action: 'accept_blocked_no_payout',
        dataType: 'campaign_invitation',
        accessedBy: influencerId,
        metadata: {
          campaignId,
          campaignTitle: campaign.title,
          currency: campaign.budgetCurrency,
        },
        reason: `Accept blocked — no payout account for ${campaign.budgetCurrency}`,
      })
      throw new PayoutAccountRequiredError(campaign.budgetCurrency)
    }

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
