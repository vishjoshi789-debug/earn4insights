import 'server-only'

import { db } from '@/db'
import {
  socialListeningRules,
  type SocialListeningRule,
  type NewSocialListeningRule,
} from '@/db/schema'
import { eq, and } from 'drizzle-orm'

// ── Writes ────────────────────────────────────────────────────────────────

/**
 * Create or update a listening rule for an entity.
 * Each entity can have multiple rules (different keyword/platform combos).
 */
export async function upsertRule(
  entityType: string,
  entityId: string,
  data: { keywords: string[]; platforms: string[]; isActive?: boolean }
): Promise<SocialListeningRule> {
  // Check if a rule already exists for this entity
  const existing = await getRulesForEntity(entityType, entityId)

  if (existing.length > 0) {
    // Update the first (primary) rule
    const [row] = await db
      .update(socialListeningRules)
      .set({
        keywords:  data.keywords,
        platforms: data.platforms,
        isActive:  data.isActive ?? true,
        updatedAt: new Date(),
      })
      .where(eq(socialListeningRules.id, existing[0].id))
      .returning()
    return row
  }

  const [row] = await db
    .insert(socialListeningRules)
    .values({
      entityType,
      entityId,
      keywords:  data.keywords,
      platforms: data.platforms,
      isActive:  data.isActive ?? true,
    })
    .returning()
  return row
}

/**
 * Toggle a rule active/inactive.
 */
export async function setRuleActive(
  ruleId: string,
  isActive: boolean
): Promise<void> {
  await db
    .update(socialListeningRules)
    .set({ isActive, updatedAt: new Date() })
    .where(eq(socialListeningRules.id, ruleId))
}

// ── Reads ─────────────────────────────────────────────────────────────────

/**
 * Get all rules for a specific entity (brand / product).
 */
export async function getRulesForEntity(
  entityType: string,
  entityId: string
): Promise<SocialListeningRule[]> {
  return db
    .select()
    .from(socialListeningRules)
    .where(
      and(
        eq(socialListeningRules.entityType, entityType),
        eq(socialListeningRules.entityId, entityId)
      )
    )
}

/**
 * Get all active rules across all entities.
 * Used by the process-social-mentions cron to match mentions to rules.
 */
export async function getAllActiveRules(): Promise<SocialListeningRule[]> {
  return db
    .select()
    .from(socialListeningRules)
    .where(eq(socialListeningRules.isActive, true))
}

/**
 * Check if a text matches a rule's keywords.
 * Case-insensitive, any keyword match = true.
 */
export function textMatchesRule(
  text: string,
  rule: SocialListeningRule
): boolean {
  const lower = text.toLowerCase()
  return rule.keywords.some(kw => lower.includes(kw.toLowerCase()))
}
