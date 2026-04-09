import 'server-only'

import { db } from '@/db'
import {
  socialMentions,
  type SocialMention,
  type NewSocialMention,
} from '@/db/schema'
import { eq, and, desc, isNull } from 'drizzle-orm'

// ── Writes ────────────────────────────────────────────────────────────────

/**
 * Insert a new social mention.
 */
export async function createMention(
  data: Omit<NewSocialMention, 'id' | 'detectedAt' | 'notificationsSent'>
): Promise<SocialMention> {
  const [row] = await db
    .insert(socialMentions)
    .values({ ...data, notificationsSent: false })
    .returning()
  return row
}

/**
 * Mark notifications as sent for a mention.
 */
export async function markNotificationsSent(mentionId: string): Promise<void> {
  await db
    .update(socialMentions)
    .set({
      notificationsSent: true,
      processedAt: new Date(),
    })
    .where(eq(socialMentions.id, mentionId))
}

/**
 * Mark a mention as processed (relevance + sentiment scored).
 */
export async function markProcessed(
  mentionId: string,
  scores: { sentimentScore?: string; relevanceScore?: string }
): Promise<void> {
  await db
    .update(socialMentions)
    .set({
      processedAt: new Date(),
      ...(scores.sentimentScore !== undefined && { sentimentScore: scores.sentimentScore }),
      ...(scores.relevanceScore !== undefined && { relevanceScore: scores.relevanceScore }),
    })
    .where(eq(socialMentions.id, mentionId))
}

// ── Reads ─────────────────────────────────────────────────────────────────

/**
 * Get unprocessed mentions (notifications not yet sent).
 * Used by the process-social-mentions cron.
 */
export async function getPendingMentions(limit = 100): Promise<SocialMention[]> {
  return db
    .select()
    .from(socialMentions)
    .where(eq(socialMentions.notificationsSent, false))
    .orderBy(desc(socialMentions.detectedAt))
    .limit(limit)
}

/**
 * Get mentions for a specific entity (product / brand).
 */
export async function getMentionsForEntity(
  entityType: string,
  entityId: string,
  limit = 50
): Promise<SocialMention[]> {
  return db
    .select()
    .from(socialMentions)
    .where(
      and(
        eq(socialMentions.mentionedEntityType, entityType),
        eq(socialMentions.mentionedEntityId, entityId)
      )
    )
    .orderBy(desc(socialMentions.detectedAt))
    .limit(limit)
}

/**
 * Get mentions by platform.
 */
export async function getMentionsByPlatform(
  platform: string,
  limit = 100
): Promise<SocialMention[]> {
  return db
    .select()
    .from(socialMentions)
    .where(eq(socialMentions.platform, platform))
    .orderBy(desc(socialMentions.detectedAt))
    .limit(limit)
}
