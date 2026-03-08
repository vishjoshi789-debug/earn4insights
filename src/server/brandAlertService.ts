/**
 * Brand Alert Service — Phase 1B
 *
 * Routes real-time signals to brands:
 * - New feedback received
 * - Negative feedback / frustration spike
 * - Survey completed
 * - High-intent consumer detected
 * - Watchlist milestone hit
 *
 * Alerts are written to brand_alerts (in-app) and optionally queued
 * to notificationService (email channel). No WebSocket yet — dashboard
 * polls brand_alerts for unread count.
 */

import { db } from '@/db'
import { brandAlerts, brandAlertRules, products } from '@/db/schema'
import { eq, and, desc, count, isNull, or } from 'drizzle-orm'
import { queueNotification } from '@/server/notificationService'

// ── Types ──────────────────────────────────────────────────────────

export type AlertType =
  | 'new_feedback'
  | 'negative_feedback'
  | 'survey_complete'
  | 'high_intent_consumer'
  | 'watchlist_milestone'
  | 'frustration_spike'

interface FireAlertInput {
  brandId: string
  alertType: AlertType
  productId?: string
  consumerId?: string
  title: string
  body: string
  payload?: Record<string, any>
}

// ── Alert Rule Management ──────────────────────────────────────────

/** Get all alert rules for a brand */
export async function getAlertRules(brandId: string) {
  return db
    .select()
    .from(brandAlertRules)
    .where(eq(brandAlertRules.brandId, brandId))
    .orderBy(brandAlertRules.createdAt)
}

/** Create or update an alert rule */
export async function upsertAlertRule(params: {
  brandId: string
  alertType: string
  productId?: string
  channels?: string[]
  threshold?: Record<string, any>
  enabled?: boolean
}) {
  const { brandId, alertType, productId, channels, threshold, enabled } = params

  // Check for existing rule (same brand + type + product)
  const existing = await db
    .select()
    .from(brandAlertRules)
    .where(
      and(
        eq(brandAlertRules.brandId, brandId),
        eq(brandAlertRules.alertType, alertType),
        productId
          ? eq(brandAlertRules.productId, productId)
          : isNull(brandAlertRules.productId),
      ),
    )
    .limit(1)

  if (existing.length > 0) {
    const [updated] = await db
      .update(brandAlertRules)
      .set({
        channels: channels || existing[0].channels,
        threshold: threshold ?? existing[0].threshold,
        enabled: enabled ?? existing[0].enabled,
        updatedAt: new Date(),
      })
      .where(eq(brandAlertRules.id, existing[0].id))
      .returning()
    return updated
  }

  const [created] = await db
    .insert(brandAlertRules)
    .values({
      brandId,
      alertType,
      productId: productId || null,
      channels: channels || ['in_app'],
      threshold: threshold || null,
      enabled: enabled ?? true,
    })
    .returning()
  return created
}

/** Toggle a rule on/off */
export async function toggleAlertRule(ruleId: string, brandId: string, enabled: boolean) {
  const [updated] = await db
    .update(brandAlertRules)
    .set({ enabled, updatedAt: new Date() })
    .where(
      and(
        eq(brandAlertRules.id, ruleId),
        eq(brandAlertRules.brandId, brandId),
      ),
    )
    .returning()
  return updated || null
}

// ── Core: Fire an Alert ────────────────────────────────────────────

/**
 * Fire a brand alert. Checks alert rules to determine channels
 * and whether the alert should be sent.
 *
 * - Always writes to brand_alerts (in-app).
 * - If the matching rule includes 'email', also queues via notificationService.
 */
export async function fireAlert(input: FireAlertInput) {
  const { brandId, alertType, productId, consumerId, title, body, payload } = input

  // Find matching rules (global rules for this alertType + product-specific rules)
  const rules = await db
    .select()
    .from(brandAlertRules)
    .where(
      and(
        eq(brandAlertRules.brandId, brandId),
        eq(brandAlertRules.alertType, alertType),
        eq(brandAlertRules.enabled, true),
      ),
    )

  // Filter rules: match product-specific OR global (productId = null)
  const matchingRules = rules.filter(
    (r) => !r.productId || r.productId === productId,
  )

  // If no matching rules, use defaults: in-app alert for everything
  const channels = new Set<string>(['in_app'])
  let matchedRuleId: string | null = null

  if (matchingRules.length > 0) {
    matchedRuleId = matchingRules[0].id
    for (const rule of matchingRules) {
      const ruleChannels = (rule.channels as string[]) || ['in_app']
      ruleChannels.forEach((ch) => channels.add(ch))
    }
  }

  // 1. Always write in-app alert
  const [alert] = await db
    .insert(brandAlerts)
    .values({
      brandId,
      ruleId: matchedRuleId,
      alertType,
      productId: productId || null,
      consumerId: consumerId || null,
      title,
      body,
      payload: payload || null,
      channel: 'in_app',
      status: 'pending',
    })
    .returning()

  // 2. If email channel is enabled, also queue email notification
  if (channels.has('email')) {
    try {
      await queueNotification({
        userId: brandId,
        channel: 'email',
        type: `brand_alert_${alertType}`,
        subject: title,
        body,
        metadata: { alertId: alert.id, alertType, productId, consumerId, ...payload },
        priority: alertType === 'frustration_spike' || alertType === 'negative_feedback' ? 1 : 3,
      })
    } catch (err) {
      console.error(`[BrandAlert] Failed to queue email for ${brandId}:`, err)
    }
  }

  return alert
}

// ── Convenience Triggers ───────────────────────────────────────────

/** Called after consumer submits feedback */
export async function alertOnNewFeedback(params: {
  brandId: string
  productId: string
  productName: string
  consumerId: string
  consumerName?: string
  feedbackId: string
  sentiment?: string
  feedbackPreview: string
}) {
  const { brandId, productId, productName, consumerId, consumerName, feedbackId, sentiment, feedbackPreview } = params

  // Always fire new_feedback
  await fireAlert({
    brandId,
    alertType: 'new_feedback',
    productId,
    consumerId,
    title: `New feedback on "${productName}"`,
    body: `${consumerName || 'A consumer'} left feedback: "${feedbackPreview.substring(0, 120)}${feedbackPreview.length > 120 ? '...' : ''}"`,
    payload: { feedbackId, sentiment },
  })

  // If sentiment is negative, also fire negative_feedback
  if (sentiment === 'negative') {
    await fireAlert({
      brandId,
      alertType: 'negative_feedback',
      productId,
      consumerId,
      title: `⚠️ Negative feedback on "${productName}"`,
      body: `${consumerName || 'A consumer'} left negative feedback: "${feedbackPreview.substring(0, 120)}${feedbackPreview.length > 120 ? '...' : ''}"`,
      payload: { feedbackId, sentiment },
    })
  }
}

/** Called after consumer completes a survey */
export async function alertOnSurveyComplete(params: {
  brandId: string
  productId: string
  productName: string
  surveyTitle: string
  consumerId?: string
  consumerName?: string
  responseId: string
  npsScore?: number
  sentiment?: string
}) {
  const { brandId, productId, productName, surveyTitle, consumerId, consumerName, responseId, npsScore, sentiment } = params

  await fireAlert({
    brandId,
    alertType: 'survey_complete',
    productId,
    consumerId,
    title: `Survey completed: "${surveyTitle}"`,
    body: `${consumerName || 'A consumer'} completed "${surveyTitle}" for ${productName}${npsScore !== undefined ? ` (NPS: ${npsScore})` : ''}`,
    payload: { responseId, npsScore, sentiment },
  })
}

/** Called when a high-intent consumer is detected */
export async function alertOnHighIntent(params: {
  brandId: string
  productId: string
  productName: string
  consumerId: string
  consumerName?: string
  intentType: string
  extractedText: string
}) {
  const { brandId, productId, productName, consumerId, consumerName, intentType, extractedText } = params

  await fireAlert({
    brandId,
    alertType: 'high_intent_consumer',
    productId,
    consumerId,
    title: `High-intent signal on "${productName}"`,
    body: `${consumerName || 'A consumer'} expressed ${intentType.replace('_', ' ')}: "${extractedText.substring(0, 100)}"`,
    payload: { intentType, extractedText },
  })
}

// ── Querying Alerts ────────────────────────────────────────────────

/** Get alerts for a brand (paginated) */
export async function getBrandAlerts(brandId: string, options?: {
  limit?: number
  offset?: number
  alertType?: string
  status?: string
}) {
  const { limit = 20, offset = 0 } = options || {}

  const conditions = [eq(brandAlerts.brandId, brandId)]
  if (options?.alertType) {
    conditions.push(eq(brandAlerts.alertType, options.alertType))
  }
  if (options?.status) {
    conditions.push(eq(brandAlerts.status, options.status))
  }

  const alerts = await db
    .select()
    .from(brandAlerts)
    .where(and(...conditions))
    .orderBy(desc(brandAlerts.createdAt))
    .limit(limit)
    .offset(offset)

  return alerts
}

/** Count unread alerts for badge */
export async function getUnreadAlertCount(brandId: string) {
  const [result] = await db
    .select({ total: count() })
    .from(brandAlerts)
    .where(
      and(
        eq(brandAlerts.brandId, brandId),
        or(
          eq(brandAlerts.status, 'pending'),
          eq(brandAlerts.status, 'sent'),
        ),
      ),
    )

  return result?.total ?? 0
}

/** Mark an alert as read */
export async function markAlertRead(alertId: string, brandId: string) {
  const [updated] = await db
    .update(brandAlerts)
    .set({ status: 'read', readAt: new Date() })
    .where(
      and(
        eq(brandAlerts.id, alertId),
        eq(brandAlerts.brandId, brandId),
      ),
    )
    .returning()

  return updated || null
}

/** Mark all alerts as read */
export async function markAllAlertsRead(brandId: string) {
  await db
    .update(brandAlerts)
    .set({ status: 'read', readAt: new Date() })
    .where(
      and(
        eq(brandAlerts.brandId, brandId),
        or(
          eq(brandAlerts.status, 'pending'),
          eq(brandAlerts.status, 'sent'),
        ),
      ),
    )
}

// ── Default Rules Bootstrap ────────────────────────────────────────

/**
 * Called on brand signup / onboarding to create sensible default alert rules.
 */
export async function bootstrapDefaultAlertRules(brandId: string) {
  const defaults: Array<{ alertType: string; channels: string[] }> = [
    { alertType: 'new_feedback', channels: ['in_app'] },
    { alertType: 'negative_feedback', channels: ['in_app', 'email'] },
    { alertType: 'survey_complete', channels: ['in_app'] },
    { alertType: 'high_intent_consumer', channels: ['in_app', 'email'] },
    { alertType: 'watchlist_milestone', channels: ['in_app'] },
    { alertType: 'frustration_spike', channels: ['in_app', 'email'] },
  ]

  for (const rule of defaults) {
    await upsertAlertRule({
      brandId,
      alertType: rule.alertType,
      channels: rule.channels,
    })
  }
}
