import 'server-only'

import { db } from '@/db'
import {
  influencerCampaigns,
  campaignInfluencers,
  type InfluencerCampaign,
  type NewInfluencerCampaign,
} from '@/db/schema'
import { eq, and, desc, count } from 'drizzle-orm'

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
    'paymentType' | 'startDate' | 'endDate' | 'platformFeePct' | 'productId' | 'icpId'
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
