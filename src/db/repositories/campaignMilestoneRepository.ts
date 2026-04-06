import 'server-only'

import { db } from '@/db'
import {
  campaignMilestones,
  type CampaignMilestone,
  type NewCampaignMilestone,
} from '@/db/schema'
import { eq, asc, sql } from 'drizzle-orm'

// ── Create ───────────────────────────────────────────────────────

export async function createMilestone(
  data: Omit<NewCampaignMilestone, 'id' | 'createdAt' | 'updatedAt'>
): Promise<CampaignMilestone> {
  const [row] = await db
    .insert(campaignMilestones)
    .values(data)
    .returning()
  return row
}

// ── Read ─────────────────────────────────────────────────────────

export async function getMilestoneById(id: string): Promise<CampaignMilestone | null> {
  const rows = await db
    .select()
    .from(campaignMilestones)
    .where(eq(campaignMilestones.id, id))
    .limit(1)
  return rows[0] ?? null
}

export async function getMilestonesByCampaign(campaignId: string): Promise<CampaignMilestone[]> {
  return db
    .select()
    .from(campaignMilestones)
    .where(eq(campaignMilestones.campaignId, campaignId))
    .orderBy(asc(campaignMilestones.sortOrder))
}

export async function getTotalMilestoneAmount(campaignId: string): Promise<number> {
  const [row] = await db
    .select({ total: sql<number>`COALESCE(SUM(${campaignMilestones.paymentAmount}), 0)` })
    .from(campaignMilestones)
    .where(eq(campaignMilestones.campaignId, campaignId))
  return Number(row?.total ?? 0)
}

// ── Update ───────────────────────────────────────────────────────

export async function updateMilestone(
  id: string,
  data: Partial<Pick<
    NewCampaignMilestone,
    'title' | 'description' | 'dueDate' | 'paymentAmount' | 'sortOrder'
  >>
): Promise<CampaignMilestone> {
  const [updated] = await db
    .update(campaignMilestones)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(campaignMilestones.id, id))
    .returning()

  if (!updated) throw new Error(`Milestone not found: ${id}`)
  return updated
}

export async function updateMilestoneStatus(
  id: string,
  status: string,
  extra?: { completedAt?: Date; approvedAt?: Date; approvedBy?: string }
): Promise<CampaignMilestone> {
  const [updated] = await db
    .update(campaignMilestones)
    .set({
      status: status as any,
      ...extra,
      updatedAt: new Date(),
    })
    .where(eq(campaignMilestones.id, id))
    .returning()

  if (!updated) throw new Error(`Milestone not found: ${id}`)
  return updated
}

// ── Delete ───────────────────────────────────────────────────────

export async function deleteMilestone(id: string): Promise<void> {
  await db
    .delete(campaignMilestones)
    .where(eq(campaignMilestones.id, id))
}
