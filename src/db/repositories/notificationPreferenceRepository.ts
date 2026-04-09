import 'server-only'

import { db } from '@/db'
import {
  notificationPreferences,
  type NotificationPreference,
  type NewNotificationPreference,
} from '@/db/schema'
import { eq, and } from 'drizzle-orm'

// ── Supported event types ─────────────────────────────────────────────────
// Keep in sync with eventBus.ts PLATFORM_EVENTS

export type NotifiableEventType =
  // Brand events
  | 'brand.product.launched'
  | 'brand.survey.created'
  | 'brand.campaign.launched'
  | 'brand.member.active'
  | 'brand.discount.created'
  | 'brand.alert.fired'
  // Consumer events
  | 'consumer.feedback.submitted'
  | 'consumer.survey.completed'
  | 'consumer.product.searched'
  | 'consumer.reward.withdrawn'
  | 'consumer.product.browsed'
  | 'consumer.community.posted'
  // Influencer events
  | 'influencer.post.published'
  | 'influencer.campaign.accepted'
  | 'influencer.milestone.completed'
  // Social events
  | 'social.mention.detected'

/**
 * Default preference for any event type not explicitly set.
 * inApp=true, email=true, sms=false — mirrors the spec.
 */
export const DEFAULT_EVENT_PREFERENCE = {
  inAppEnabled: true,
  emailEnabled: true,
  smsEnabled: false,
} as const

// ── Writes ────────────────────────────────────────────────────────────────

/**
 * Upsert a notification preference for one (userId, eventType) pair.
 * Creates if not exists, updates if exists.
 */
export async function upsertPreference(
  userId: string,
  eventType: NotifiableEventType,
  prefs: { inAppEnabled?: boolean; emailEnabled?: boolean; smsEnabled?: boolean }
): Promise<NotificationPreference> {
  const [row] = await db
    .insert(notificationPreferences)
    .values({
      userId,
      eventType,
      inAppEnabled: prefs.inAppEnabled ?? DEFAULT_EVENT_PREFERENCE.inAppEnabled,
      emailEnabled: prefs.emailEnabled ?? DEFAULT_EVENT_PREFERENCE.emailEnabled,
      smsEnabled:   prefs.smsEnabled   ?? DEFAULT_EVENT_PREFERENCE.smsEnabled,
    })
    .onConflictDoUpdate({
      target: [notificationPreferences.userId, notificationPreferences.eventType],
      set: {
        inAppEnabled: prefs.inAppEnabled ?? DEFAULT_EVENT_PREFERENCE.inAppEnabled,
        emailEnabled: prefs.emailEnabled ?? DEFAULT_EVENT_PREFERENCE.emailEnabled,
        smsEnabled:   prefs.smsEnabled   ?? DEFAULT_EVENT_PREFERENCE.smsEnabled,
        updatedAt: new Date(),
      },
    })
    .returning()

  return row
}

// ── Reads ─────────────────────────────────────────────────────────────────

/**
 * Get all preferences for a user (returns saved rows only).
 * For event types without a row, callers should use DEFAULT_EVENT_PREFERENCE.
 */
export async function getAllPreferences(
  userId: string
): Promise<NotificationPreference[]> {
  return db
    .select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, userId))
}

/**
 * Get the preference for one specific (userId, eventType) pair.
 * Returns DEFAULT_EVENT_PREFERENCE if no row exists.
 */
export async function getPreference(
  userId: string,
  eventType: string
): Promise<{ inAppEnabled: boolean; emailEnabled: boolean; smsEnabled: boolean }> {
  const rows = await db
    .select()
    .from(notificationPreferences)
    .where(
      and(
        eq(notificationPreferences.userId, userId),
        eq(notificationPreferences.eventType, eventType)
      )
    )
    .limit(1)

  if (rows.length === 0) return { ...DEFAULT_EVENT_PREFERENCE }

  const row = rows[0]
  return {
    inAppEnabled: row.inAppEnabled,
    emailEnabled: row.emailEnabled,
    smsEnabled:   row.smsEnabled,
  }
}

/**
 * Build a lookup map of eventType → preferences for a user.
 * Fills gaps with defaults so callers never need to handle missing entries.
 */
export async function getPreferenceMap(
  userId: string,
  eventTypes: string[]
): Promise<Record<string, { inAppEnabled: boolean; emailEnabled: boolean; smsEnabled: boolean }>> {
  const saved = await getAllPreferences(userId)
  const savedMap = Object.fromEntries(saved.map(p => [p.eventType, p]))

  const result: Record<string, { inAppEnabled: boolean; emailEnabled: boolean; smsEnabled: boolean }> = {}
  for (const et of eventTypes) {
    const row = savedMap[et]
    result[et] = row
      ? { inAppEnabled: row.inAppEnabled, emailEnabled: row.emailEnabled, smsEnabled: row.smsEnabled }
      : { ...DEFAULT_EVENT_PREFERENCE }
  }
  return result
}
