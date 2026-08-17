import 'server-only'

import { db } from '@/db'
import {
  notificationPreferences,
  type NotificationPreference,
  type NewNotificationPreference,
} from '@/db/schema'
import { eq, and } from 'drizzle-orm'

// ── Supported event types ─────────────────────────────────────────────────
//
// A runtime array, not just a type union, because the POST route needs to
// VALIDATE what it stores. Previously the route cast any incoming string to
// `NotifiableEventType` and wrote it, so a typo (or anything else) created a
// permanent junk row that `getPreference` would never read — silently leaving
// the user on defaults while the UI showed their choice saved.
//
// ⚠️ Keep in sync with `PLATFORM_EVENTS` in `src/server/eventBus.ts`. Not
// imported from there on purpose: eventBus imports repositories, so the
// reverse import would close a cycle. The old union covered 16 of ~40 events,
// which meant every preference for a payment, deal, community or support
// notification was untyped.
export const NOTIFIABLE_EVENT_TYPES = [
  // Brand
  'brand.product.launched',
  'brand.survey.created',
  'brand.campaign.launched',
  'brand.member.active',
  'brand.discount.created',
  'brand.alert.fired',
  'brand.content.pending_review',
  'brand.content.auto_approved',
  'brand.application.accepted',
  'brand.application.rejected',
  // Consumer
  'consumer.feedback.submitted',
  'consumer.feedback.addressed',
  'consumer.survey.completed',
  'consumer.product.searched',
  'consumer.product.browsed',
  'consumer.reward.withdrawn',
  'consumer.reward.redeemed',
  'consumer.community.posted',
  // Influencer
  'influencer.post.published',
  'influencer.campaign.accepted',
  'influencer.campaign.applied',
  'influencer.milestone.completed',
  'influencer.content.approved',
  'influencer.content.rejected',
  'influencer.campaign.invited',
  'influencer.review.received',
  // Social
  'social.mention.detected',
  // Payments
  'payment.order.created',
  'payment.escrowed',
  'payment.released',
  'payment.failed',
  'payment.payout.initiated',
  'payment.payout.completed',
  'payment.payout.failed',
  // Deals & community
  'deal.expired',
  'community.deal.flagged',
  'community.deal.approved',
  'community.deal.rejected',
  // Support
  'support.ticket_created',
  'support.ticket_updated',
  'support.ticket_resolved',
  'support.chat_escalated',
  'support.admin_reply',
] as const

export type NotifiableEventType = (typeof NOTIFIABLE_EVENT_TYPES)[number]

const NOTIFIABLE_EVENT_SET: ReadonlySet<string> = new Set(NOTIFIABLE_EVENT_TYPES)

/** Runtime guard for API input. */
export function isNotifiableEventType(value: string): value is NotifiableEventType {
  return NOTIFIABLE_EVENT_SET.has(value)
}

/**
 * Default preference for any event type not explicitly set.
 * inApp=true, email=true, sms=false — mirrors the spec.
 *
 * ✅ REACHABLE since 2026-08-10 — `NotificationPreferencesCard` on
 * /dashboard/settings reads and writes these. (It was previously enforced in
 * `dispatchToUser` but settable nowhere, so every user was pinned to the
 * defaults and the only way to stop email was to mark it as spam.)
 *
 * ⚠️ These defaults apply to any (user, eventType) pair with no row, which is
 * most of them — the UI writes a row only when a switch is flipped. So
 * changing a value here silently changes behaviour for every user who has
 * never touched their settings.
 *
 * NOT gated by these preferences, deliberately: email verification and
 * password reset. Both call Resend directly rather than going through
 * `dispatchToUser`, because a user who opted out of email would otherwise be
 * locked out of their own account. The settings UI states this explicitly.
 */
export const DEFAULT_EVENT_PREFERENCE = {
  inAppEnabled: true,
  emailEnabled: true,
  smsEnabled: false,
} as const

// ── Writes ────────────────────────────────────────────────────────────────

/**
 * Upsert a notification preference for one (userId, eventType) pair.
 * Creates if not exists, PARTIALLY updates if exists.
 *
 * 🐛 FIXED 2026-08-10 — the update branch used to write
 * `prefs.x ?? DEFAULT_EVENT_PREFERENCE.x` for ALL THREE fields, so any field
 * the caller didn't mention was reset to its default rather than left alone.
 * Concretely: turn email OFF, then later turn in-app off, and the second call
 * silently switches email back ON. That is a withdrawn consent quietly
 * reinstated — the exact obligation this feature exists to meet. The bug
 * survived because the function had zero callers until the settings UI.
 *
 * Now the `set` object contains only the keys actually supplied. Defaults are
 * still used for INSERT, where they are correct: a brand-new row has to start
 * somewhere.
 *
 * Relies on `UNIQUE(user_id, event_type)`, created by migration 005.
 * ⚠️ That constraint is NOT declared in schema.ts — a drift worth knowing
 * about, since Drizzle emits the ON CONFLICT target from the column list and
 * Postgres resolves it against the real constraint.
 */
export async function upsertPreference(
  userId: string,
  eventType: NotifiableEventType,
  prefs: { inAppEnabled?: boolean; emailEnabled?: boolean; smsEnabled?: boolean }
): Promise<NotificationPreference> {
  // Only the supplied fields — see the note above.
  const patch: Partial<NewNotificationPreference> = { updatedAt: new Date() }
  if (prefs.inAppEnabled !== undefined) patch.inAppEnabled = prefs.inAppEnabled
  if (prefs.emailEnabled !== undefined) patch.emailEnabled = prefs.emailEnabled
  if (prefs.smsEnabled   !== undefined) patch.smsEnabled   = prefs.smsEnabled

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
      set: patch,
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
