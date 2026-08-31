import 'server-only'

import { db } from '@/db'
import {
  influencerCampaigns,
  campaignInfluencers,
  type InfluencerCampaign,
  type NewInfluencerCampaign,
} from '@/db/schema'
import { eq, and, desc, count, inArray } from 'drizzle-orm'
import {
  PARTICIPATING_INVITATION_STATUSES,
  isParticipatingStatus,
} from '@/lib/campaigns/participation'

// ── Create ───────────────────────────────────────────────────────

export async function createCampaign(
  data: Omit<NewInfluencerCampaign, 'id' | 'createdAt' | 'updatedAt'>
): Promise<InfluencerCampaign> {
  const [row] = await db
    .insert(influencerCampaigns)
    .values(data)
    .returning()
  return row
}

// ── Read ─────────────────────────────────────────────────────────

export async function getCampaignById(id: string): Promise<InfluencerCampaign | null> {
  const rows = await db
    .select()
    .from(influencerCampaigns)
    .where(eq(influencerCampaigns.id, id))
    .limit(1)
  return rows[0] ?? null
}

export async function getCampaignsByBrand(
  brandId: string,
  opts?: { status?: string; limit?: number; offset?: number }
): Promise<InfluencerCampaign[]> {
  const conditions = [eq(influencerCampaigns.brandId, brandId)]

  if (opts?.status) {
    conditions.push(eq(influencerCampaigns.status, opts.status as any))
  }

  return db
    .select()
    .from(influencerCampaigns)
    .where(and(...conditions))
    .orderBy(desc(influencerCampaigns.createdAt))
    .limit(opts?.limit ?? 50)
    .offset(opts?.offset ?? 0)
}

export async function getCampaignsByInfluencer(
  influencerId: string,
  opts?: { status?: string }
): Promise<(InfluencerCampaign & { invitationStatus: string; agreedRate: number | null })[]> {
  const conditions = [eq(campaignInfluencers.influencerId, influencerId)]

  if (opts?.status) {
    conditions.push(eq(campaignInfluencers.status, opts.status as any))
  }

  const rows = await db
    .select({
      campaign: influencerCampaigns,
      invitationStatus: campaignInfluencers.status,
      agreedRate: campaignInfluencers.agreedRate,
    })
    .from(campaignInfluencers)
    .innerJoin(influencerCampaigns, eq(campaignInfluencers.campaignId, influencerCampaigns.id))
    .where(and(...conditions))
    .orderBy(desc(influencerCampaigns.createdAt))

  return rows.map(r => ({
    ...r.campaign,
    invitationStatus: r.invitationStatus,
    agreedRate: r.agreedRate,
  }))
}

export async function countCampaignsByBrand(brandId: string): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(influencerCampaigns)
    .where(eq(influencerCampaigns.brandId, brandId))
  return row?.total ?? 0
}

// ── Update ───────────────────────────────────────────────────────

export async function updateCampaign(
  id: string,
  data: Partial<Pick<
    NewInfluencerCampaign,
    'title' | 'brief' | 'requirements' | 'deliverables' |
    'targetGeography' | 'targetPlatforms' | 'budgetTotal' | 'budgetCurrency' |
    'paymentType' | 'startDate' | 'endDate' | 'platformFeePct' | 'productId' | 'icpId' |
    'isPublic' | 'maxInfluencers' | 'applicationDeadline' |
    'reviewSlaHours' | 'autoApproveEnabled'
  >>
): Promise<InfluencerCampaign> {
  const [updated] = await db
    .update(influencerCampaigns)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(influencerCampaigns.id, id))
    .returning()

  if (!updated) throw new Error(`Campaign not found: ${id}`)
  return updated
}

export async function updateCampaignStatus(
  id: string,
  status: string
): Promise<InfluencerCampaign> {
  const [updated] = await db
    .update(influencerCampaigns)
    .set({ status: status as any, updatedAt: new Date() })
    .where(eq(influencerCampaigns.id, id))
    .returning()

  if (!updated) throw new Error(`Campaign not found: ${id}`)
  return updated
}

// ── Delete ───────────────────────────────────────────────────────

export async function deleteCampaign(id: string): Promise<void> {
  await db
    .delete(influencerCampaigns)
    .where(eq(influencerCampaigns.id, id))
}

/**
 * Campaigns the creator is actually ON — accepted, active or completed.
 *
 * Distinct from getCampaignsByInfluencer, which takes a SINGLE optional status
 * and therefore cannot express this set: unfiltered it returns everything
 * including 'invited' and 'rejected', and `?status=accepted` misses 'active'
 * and 'completed'. That gap is why this exists rather than reusing it.
 *
 * Backs both the content-submission campaign selector AND the server-side
 * membership check behind it, so the list a creator is offered and the list
 * the API will accept cannot drift apart.
 */
export async function getParticipatingCampaignsForInfluencer(
  influencerId: string,
): Promise<{ id: string; title: string; invitationStatus: string }[]> {
  const rows = await db
    .select({
      id: influencerCampaigns.id,
      title: influencerCampaigns.title,
      invitationStatus: campaignInfluencers.status,
    })
    .from(campaignInfluencers)
    .innerJoin(influencerCampaigns, eq(campaignInfluencers.campaignId, influencerCampaigns.id))
    .where(
      and(
        eq(campaignInfluencers.influencerId, influencerId),
        // Spread, NOT a widening cast. `as unknown as string[]` compiles the
        // constant down to string[] and Drizzle rejects it, because the column
        // is typed to its own literal union — the spread keeps the literals.
        inArray(campaignInfluencers.status, [...PARTICIPATING_INVITATION_STATUSES]),
      ),
    )
    .orderBy(desc(influencerCampaigns.createdAt))

  return rows
}

/**
 * Is this creator a participating member of this campaign?
 *
 * ⚠️ This is the SERVER-SIDE control. The selector only shapes what is offered;
 * a creator can POST any campaignId, and campaignId is in the PATCH allow-list
 * so it can also be attached after the fact. Both paths must call this.
 */
export async function isCampaignParticipant(
  campaignId: string,
  influencerId: string,
): Promise<boolean> {
  const rows = await db
    .select({ status: campaignInfluencers.status })
    .from(campaignInfluencers)
    .where(
      and(
        eq(campaignInfluencers.campaignId, campaignId),
        eq(campaignInfluencers.influencerId, influencerId),
      ),
    )
    .limit(1)
  return isParticipatingStatus(rows[0]?.status)
}
