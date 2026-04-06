import 'server-only'

import { db } from '@/db'
import {
  campaignDisputes,
  type CampaignDispute,
  type NewCampaignDispute,
} from '@/db/schema'
import { eq, and, desc } from 'drizzle-orm'

// ── Create ───────────────────────────────────────────────────────

export async function createDispute(
  data: Omit<NewCampaignDispute, 'id' | 'createdAt' | 'updatedAt'>
): Promise<CampaignDispute> {
  const [row] = await db
    .insert(campaignDisputes)
    .values(data)
    .returning()
  return row
}

// ── Read ─────────────────────────────────────────────────────────

export async function getDisputeById(id: string): Promise<CampaignDispute | null> {
  const rows = await db
    .select()
    .from(campaignDisputes)
    .where(eq(campaignDisputes.id, id))
    .limit(1)
  return rows[0] ?? null
}

export async function getDisputesByCampaign(campaignId: string): Promise<CampaignDispute[]> {
  return db
    .select()
    .from(campaignDisputes)
    .where(eq(campaignDisputes.campaignId, campaignId))
    .orderBy(desc(campaignDisputes.createdAt))
}

export async function getDisputesByStatus(
  status: string,
  opts?: { limit?: number; offset?: number }
): Promise<CampaignDispute[]> {
  return db
    .select()
    .from(campaignDisputes)
    .where(eq(campaignDisputes.status, status as any))
    .orderBy(desc(campaignDisputes.createdAt))
    .limit(opts?.limit ?? 50)
    .offset(opts?.offset ?? 0)
}

// ── Update ───────────────────────────────────────────────────────

export async function resolveDispute(
  id: string,
  data: { resolvedBy: string; resolution: string; status: 'resolved' | 'closed' }
): Promise<CampaignDispute> {
  const [updated] = await db
    .update(campaignDisputes)
    .set({
      resolvedBy: data.resolvedBy,
      resolution: data.resolution,
      status: data.status,
      resolvedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(campaignDisputes.id, id))
    .returning()

  if (!updated) throw new Error(`Dispute not found: ${id}`)
  return updated
}

export async function updateDisputeStatus(id: string, status: string): Promise<CampaignDispute> {
  const [updated] = await db
    .update(campaignDisputes)
    .set({ status: status as any, updatedAt: new Date() })
    .where(eq(campaignDisputes.id, id))
    .returning()

  if (!updated) throw new Error(`Dispute not found: ${id}`)
  return updated
}
