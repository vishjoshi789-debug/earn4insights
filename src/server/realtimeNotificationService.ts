import 'server-only'

import { createInboxItem }    from '@/db/repositories/notificationInboxRepository'
import { createFeedItem }     from '@/db/repositories/activityFeedRepository'
import { getPreference }      from '@/db/repositories/notificationPreferenceRepository'
import { checkConsent }       from '@/lib/consent-enforcement'
import { queueNotification }  from '@/server/notificationService'
import { triggerPusherEvent, userChannel, PUSHER_EVENTS } from '@/lib/pusher'
import { getUnreadCount }     from '@/db/repositories/notificationInboxRepository'

// ── Types ─────────────────────────────────────────────────────────────────

export interface NotificationTarget {
  userId: string
  role: 'brand' | 'consumer' | 'admin'
}

export interface DispatchPayload {
  eventType:   string
  eventId?:    string            // realtime_events.id for audit linkage
  title:       string
  body:        string
  ctaUrl?:     string
  type:        string            // maps to NotificationInboxItem.type
  actorId?:    string
  actorRole?:  string
  entityType?: string
  entityId?:   string
  metadata?:   Record<string, unknown>
  // Email fallback fields
  emailSubject?: string
  emailBody?:    string
}

export interface DispatchResult {
  userId:          string
  inboxCreated:    boolean
  pusherSent:      boolean
  emailQueued:     boolean
  skippedConsent?: boolean
  skippedPref?:    boolean
}

// ── Core dispatch ─────────────────────────────────────────────────────────

/**
 * Dispatch a notification to a single target user.
 *
 * Flow (Option A — inbox-first):
 *   1. Check event-type preference → skip if inApp+email+sms all disabled
 *   2. Check consent for personalization (skip if denied, don't penalise)
 *   3. Write to notification_inbox  ← source of truth, always
 *   4. Write to activity_feed_items ← always
 *   5. Trigger Pusher push          ← best-effort, never throws
 *   6. Queue email/SMS              ← if user has those channels enabled
 */
export async function dispatchToUser(
  target: NotificationTarget,
  payload: DispatchPayload
): Promise<DispatchResult> {
  const result: DispatchResult = {
    userId:       target.userId,
    inboxCreated: false,
    pusherSent:   false,
    emailQueued:  false,
  }

  // ── Step 1: Check event-type preference ─────────────────────────────
  const pref = await getPreference(target.userId, payload.eventType)
  if (!pref.inAppEnabled && !pref.emailEnabled && !pref.smsEnabled) {
    result.skippedPref = true
    return result
  }

  // ── Step 2: Consent check for personalization ────────────────────────
  // Consumers must have 'personalization' consent for us to target them.
  // Brands and admins are never consent-gated for notification delivery.
  if (target.role === 'consumer') {
    const { allowed } = await checkConsent(target.userId, 'personalization')
    if (!allowed) {
      result.skippedConsent = true
      return result
    }
  }

  // ── Step 3: Write to notification_inbox ─────────────────────────────
  if (pref.inAppEnabled) {
    try {
      await createInboxItem({
        userId:  target.userId,
        eventId: payload.eventId ?? null,
        title:   payload.title,
        body:    payload.body,
        ctaUrl:  payload.ctaUrl ?? null,
        type:    payload.type,
      })
      result.inboxCreated = true
    } catch (err) {
      console.error(`[RealtimeNotification] Failed to create inbox item for ${target.userId}:`, err)
    }
  }

  // ── Step 4: Write to activity_feed_items ────────────────────────────
  try {
    await createFeedItem({
      userId:      target.userId,
      eventType:   payload.eventType,
      actorId:     payload.actorId ?? null,
      actorRole:   payload.actorRole ?? null,
      title:       payload.title,
      description: payload.body,
      entityType:  payload.entityType ?? null,
      entityId:    payload.entityId ?? null,
      metadata:    payload.metadata ?? null,
    })
  } catch (err) {
    console.error(`[RealtimeNotification] Failed to create feed item for ${target.userId}:`, err)
  }

  // ── Step 5: Pusher real-time push (best-effort) ──────────────────────
  if (pref.inAppEnabled) {
    try {
      // Fire push with notification data
      await triggerPusherEvent(
        userChannel(target.userId),
        PUSHER_EVENTS.NEW_NOTIFICATION,
        {
          id:        payload.eventId ?? null,
          title:     payload.title,
          body:      payload.body,
          ctaUrl:    payload.ctaUrl ?? null,
          type:      payload.type,
          eventType: payload.eventType,
          createdAt: new Date().toISOString(),
        }
      )

      // Also push updated unread count
      const unreadCount = await getUnreadCount(target.userId)
      await triggerPusherEvent(
        userChannel(target.userId),
        PUSHER_EVENTS.UNREAD_COUNT_UPDATE,
        { count: unreadCount }
      )

      result.pusherSent = true
    } catch {
      // Pusher failure never propagates — it's an enhancement layer
    }
  }

  // ── Step 6: Queue email/SMS via existing infrastructure ─────────────
  if (pref.emailEnabled) {
    try {
      await queueNotification({
        userId:  target.userId,
        channel: 'email',
        type:    payload.eventType,
        subject: payload.emailSubject ?? payload.title,
        body:    payload.emailBody ?? payload.body,
        metadata: {
          ctaUrl:     payload.ctaUrl,
          entityType: payload.entityType,
          entityId:   payload.entityId,
          ...payload.metadata,
        },
        priority: 5,
      })
      result.emailQueued = true
    } catch (err) {
      console.error(`[RealtimeNotification] Failed to queue email for ${target.userId}:`, err)
    }
  }

  if (pref.smsEnabled) {
    try {
      await queueNotification({
        userId:  target.userId,
        channel: 'sms',
        type:    payload.eventType,
        body:    payload.body,
        priority: 3,
      })
    } catch (err) {
      console.error(`[RealtimeNotification] Failed to queue SMS for ${target.userId}:`, err)
    }
  }

  return result
}

/**
 * Dispatch the same notification to multiple users in parallel.
 * Capped at 50 concurrent dispatches to avoid DB connection pressure.
 */
export async function dispatchToUsers(
  targets: NotificationTarget[],
  payload: DispatchPayload
): Promise<DispatchResult[]> {
  if (targets.length === 0) return []

  const CONCURRENCY = 50
  const results: DispatchResult[] = []

  for (let i = 0; i < targets.length; i += CONCURRENCY) {
    const batch = targets.slice(i, i + CONCURRENCY)
    const batchResults = await Promise.all(
      batch.map(target => dispatchToUser(target, payload))
    )
    results.push(...batchResults)
  }

  return results
}
