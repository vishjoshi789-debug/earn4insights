import 'server-only'

import { db } from '@/db'
import {
  campaignInfluencers,
  type CampaignInfluencer,
  type NewCampaignInfluencer,
} from '@/db/schema'
import { eq, and } from 'drizzle-orm'

// ── Create ───────────────────────────────────────────────────────

export async function inviteInfluencer(data: {
  campaignId: string
  influencerId: string
  deliverables?: string[]
  agreedRate?: number
}): Promise<CampaignInfluencer> {
  const [row] = await db
    .insert(campaignInfluencers)
    .values({
      campaignId: data.campaignId,
      influencerId: data.influencerId,
      deliverables: data.deliverables ?? [],
      agreedRate: data.agreedRate ?? null,
      status: 'invited',
    })
    .returning()
  return row
}

// ── Read ─────────────────────────────────────────────────────────

export async function getInfluencersByCampaign(campaignId: string): Promise<CampaignInfluencer[]> {
  return db
    .select()
    .from(campaignInfluencers)
    .where(eq(campaignInfluencers.campaignId, campaignId))
}

export async function getCampaignsByInfluencer(
  influencerId: string,
  opts?: { status?: string }
): Promise<CampaignInfluencer[]> {
  const conditions = [eq(campaignInfluencers.influencerId, influencerId)]
  if (opts?.status) {
    conditions.push(eq(campaignInfluencers.status, opts.status as any))
  }
  return db
    .select()
    .from(campaignInfluencers)
    .where(and(...conditions))
}

export async function getInvitation(
  campaignId: string,
  influencerId: string
): Promise<CampaignInfluencer | null> {
  const rows = await db
    .select()
    .from(campaignInfluencers)
    .where(
      and(
        eq(campaignInfluencers.campaignId, campaignId),
        eq(campaignInfluencers.influencerId, influencerId)
      )
    )
    .limit(1)
  return rows[0] ?? null
}

// ── Update ───────────────────────────────────────────────────────

export async function updateInvitationStatus(
  campaignId: string,
  influencerId: string,
  status: string,
  extra?: { acceptedAt?: Date; completedAt?: Date; agreedRate?: number }
): Promise<CampaignInfluencer> {
  const [updated] = await db
    .update(campaignInfluencers)
    .set({
      status: status as any,
      ...extra,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(campaignInfluencers.campaignId, campaignId),
        eq(campaignInfluencers.influencerId, influencerId)
      )
    )
    .returning()

  if (!updated) throw new Error(`Invitation not found: campaign=${campaignId}, influencer=${influencerId}`)
  return updated
}

// ── Delete ───────────────────────────────────────────────────────

export async function removeInfluencer(campaignId: string, influencerId: string): Promise<void> {
  await db
    .delete(campaignInfluencers)
    .where(
      and(
        eq(campaignInfluencers.campaignId, campaignId),
        eq(campaignInfluencers.influencerId, influencerId)
      )
    )
}
