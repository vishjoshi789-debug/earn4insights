/**
 * Brand Alert Service — Phase 1B + Phase 9 (ICP-aware)
 *
 * Routes real-time signals to brands:
 * - New feedback received
 * - Negative feedback / frustration spike
 * - Survey completed
 * - High-intent consumer detected
 * - Watchlist milestone hit
 * - ICP match: consumer crossed an ICP's score threshold (Phase 9)
 *
 * Phase 9 additions:
 * - Alert rules can be ICP-gated (rule.icpId + rule.minMatchScore).
 *   When set, the alert only fires if the consumer's cached match score
 *   for that ICP meets the threshold. Score is computed on-demand if stale/missing.
 * - brand_alerts now stores matchScoreSnapshot so brands can see why an
 *   ICP-gated alert fired.
 *
 * Alerts are written to brand_alerts (in-app) and optionally queued
 * to notificationService (email channel). No WebSocket yet — dashboard
 * polls brand_alerts for unread count.
 */

import { db } from '@/db'
import { brandAlerts, brandAlertRules } from '@/db/schema'
import { eq, and, desc, count, isNull, or } from 'drizzle-orm'
import { queueNotification } from '@/server/notificationService'
import { sendSlackNotification } from '@/server/slackNotifications'
import { sendWhatsAppAlertMessage } from '@/server/whatsappNotifications'
import { getUserProfile } from '@/db/repositories/userProfileRepository'
import { getMatchScore, getIcpById } from '@/db/repositories/icpRepository'
import { scoreConsumerForIcp } from '@/server/icpMatchScoringService'
import type { IcpMatchBreakdown } from '@/db/repositories/icpRepository'
import type { BrandAlert } from '@/db/schema'

// ── Types ──────────────────────────────────────────────────────────

export type AlertType =
  | 'new_feedback'
  | 'negative_feedback'
  | 'survey_complete'
  | 'high_intent_consumer'
  | 'watchlist_milestone'
  | 'frustration_spike'
  | 'icp_match'                  // Phase 9: consumer crossed an ICP threshold

type MatchScoreSnapshot = NonNullable<BrandAlert['matchScoreSnapshot']>

interface FireAlertInput {
  brandId: string
  alertType: AlertType
  productId?: string
  consumerId?: string
  title: string
  body: string
  payload?: Record<string, any>
  // Pre-computed snapshot from scoring engine (skips re-fetch when caller already has it)
  matchScoreSnapshot?: MatchScoreSnapshot
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
  // Phase 9: ICP gating
  icpId?: string       // when set, alert fires only if consumer score >= minMatchScore
  minMatchScore?: number  // 0-100, defaults to 60
}) {
  const { brandId, alertType, productId, channels, threshold, enabled, icpId, minMatchScore } = params

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
        ...(icpId !== undefined && { icpId }),
        ...(minMatchScore !== undefined && { minMatchScore }),
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
      icpId: icpId ?? null,
      minMatchScore: minMatchScore ?? 60,
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
 * Phase 9 ICP gating:
 * - If a matching rule has `icpId` set, the alert only fires for that rule's
 *   channels if the consumer's ICP match score >= `rule.minMatchScore`.
 * - Score is read from the cache (icp_match_scores) if fresh, computed on-demand
 *   if missing/stale, and attached to the alert record as matchScoreSnapshot.
 * - Rules without `icpId` always fire (existing behaviour unchanged).
 * - Returns null (not stored) if all matching ICP-gated rules are suppressed
 *   and there are no non-ICP-gated rules that match.
 */
export async function fireAlert(input: FireAlertInput): Promise<BrandAlert | null> {
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

  // ── ICP gating (Phase 9) ──────────────────────────────────────
  // Evaluate each rule independently. Rules with icpId are only included
  // in the effective channel set if the consumer's match score qualifies.
  const effectiveChannels = new Set<string>()
  let matchedRuleId: string | null = null
  let resolvedSnapshot: MatchScoreSnapshot | null = input.matchScoreSnapshot ?? null

  if (matchingRules.length === 0) {
    // No rules configured — fall back to default channels
    effectiveChannels.add('in_app')
    effectiveChannels.add('email')
  } else {
    let atLeastOneRuleFired = false

    for (const rule of matchingRules) {
      let rulePasses = true

      if (rule.icpId) {
        if (!consumerId) {
          // Can't ICP-gate without a consumer — suppress this rule silently
          rulePasses = false
        } else {
          const minScore = rule.minMatchScore ?? 60
          const snapshot = await resolveMatchScore(rule.icpId, consumerId)

          if (snapshot === null || snapshot.matchScore < minScore) {
            rulePasses = false
          } else {
            // Keep the highest-scoring snapshot across multiple ICP-gated rules
            if (!resolvedSnapshot || snapshot.matchScore > resolvedSnapshot.matchScore) {
              resolvedSnapshot = snapshot
            }
          }
        }
      }

      if (rulePasses) {
        atLeastOneRuleFired = true
        if (!matchedRuleId) matchedRuleId = rule.id
        const ruleChannels = (rule.channels as string[]) || ['in_app']
        ruleChannels.forEach((ch) => effectiveChannels.add(ch))
      }
    }

    // All rules were ICP-gated and suppressed — do not write an alert
    if (!atLeastOneRuleFired) {
      return null
    }
  }

  // Always include in_app
  effectiveChannels.add('in_app')

  // 1. Write in-app alert (with optional match score snapshot)
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
      matchScoreSnapshot: resolvedSnapshot ?? undefined,
    })
    .returning()

  // 2. If email channel is enabled, also queue email notification
  if (effectiveChannels.has('email')) {
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

  // 3. If slack or whatsapp channel is enabled, fetch brand profile once for both
  let brandProfile: Awaited<ReturnType<typeof getUserProfile>> | null = null
  if (effectiveChannels.has('slack') || effectiveChannels.has('whatsapp')) {
    try {
      brandProfile = await getUserProfile(brandId)
    } catch (err) {
      console.error(`[BrandAlert] Failed to fetch brand profile for ${brandId}:`, err)
    }
  }

  // 3a. Slack — send to brand's configured webhook
  if (effectiveChannels.has('slack') && brandProfile) {
    try {
      const slackPrefs = (brandProfile.notificationPreferences as any)?.slack
      const webhookUrl = slackPrefs?.webhookUrl as string | undefined
      if (webhookUrl) {
        sendSlackNotification({
          webhookUrl,
          title,
          body,
          alertType,
          metadata: { alertId: alert.id, productId, consumerId, ...payload },
        }).catch((err) => console.error('[BrandAlert] Slack send error:', err))
      } else {
        console.warn(`[BrandAlert] Slack channel enabled for ${brandId} but no webhookUrl configured`)
      }
    } catch (err) {
      console.error(`[BrandAlert] Failed to send Slack notification for ${brandId}:`, err)
    }
  }

  // 3b. WhatsApp — send immediately via Twilio (real-time)
  if (effectiveChannels.has('whatsapp') && brandProfile) {
    try {
      const waPrefs = (brandProfile.notificationPreferences as any)?.whatsapp
      const phoneNumber = waPrefs?.phoneNumber as string | undefined
      if (phoneNumber) {
        sendWhatsAppAlertMessage({
          phoneNumber,
          title,
          body,
          alertType,
          ctaUrl: 'https://earn4insights.com/dashboard/alerts',
        }).catch((err) => console.error('[BrandAlert] WhatsApp send error:', err))
      } else {
        console.warn(`[BrandAlert] WhatsApp channel enabled for ${brandId} but no phone number configured`)
      }
    } catch (err) {
      console.error(`[BrandAlert] Failed to send WhatsApp notification for ${brandId}:`, err)
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

// ── Phase 9: ICP match alert ───────────────────────────────────────

/**
 * Fire an 'icp_match' alert when a consumer's score crosses an ICP's threshold.
 *
 * Called by the daily recompute cron (recomputeIcpScores.ts) after a consumer
 * newly qualifies for an ICP. The caller already has the breakdown — it is
 * passed directly to avoid re-fetching.
 *
 * If the brand has an ICP-gated alert rule pointing at this ICP, the ICP gate
 * is satisfied automatically (we're already above threshold). The snapshot is
 * attached to the alert so the brand can see the detailed score breakdown.
 */
export async function alertOnIcpMatch(params: {
  brandId: string
  productId?: string
  consumerId: string
  icpId: string
  icpName: string
  matchScore: number
  breakdown: IcpMatchBreakdown
}): Promise<BrandAlert | null> {
  const { brandId, productId, consumerId, icpId, icpName, matchScore, breakdown } = params

  const snapshot: MatchScoreSnapshot = {
    matchScore,
    criteriaScores: breakdown.criteriaScores,
    totalEarned: breakdown.totalEarned,
    totalPossible: breakdown.totalPossible,
    consentGaps: breakdown.consentGaps,
    explainability: breakdown.explainability,
  }

  return fireAlert({
    brandId,
    alertType: 'icp_match',
    productId,
    consumerId,
    title: `New ICP match: "${icpName}"`,
    body:
      `A consumer matched your ICP "${icpName}" with a score of ${matchScore}/100. ` +
      breakdown.explainability,
    payload: { icpId, icpName, matchScore },
    matchScoreSnapshot: snapshot,
  })
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
    { alertType: 'icp_match', channels: ['in_app', 'email'] },
  ]

  for (const rule of defaults) {
    await upsertAlertRule({
      brandId,
      alertType: rule.alertType,
      channels: rule.channels,
    })
  }
}

// ── Internal helpers ───────────────────────────────────────────────

/**
 * Get a consumer's match score for an ICP.
 * Uses the cached score if present and not stale; recomputes on-demand otherwise.
 * Returns null if the ICP doesn't exist.
 */
async function resolveMatchScore(
  icpId: string,
  consumerId: string
): Promise<MatchScoreSnapshot | null> {
  // Try cache first
  const cached = await getMatchScore(icpId, consumerId)

  if (cached && !cached.isStale) {
    return {
      matchScore: cached.matchScore,
      ...(cached.breakdown as Omit<MatchScoreSnapshot, 'matchScore'>),
    }
  }

  // Cache miss or stale — compute on demand
  try {
    const icp = await getIcpById(icpId)
    if (!icp || !icp.isActive) return null

    const result = await scoreConsumerForIcp(icpId, consumerId, true)
    return {
      matchScore: result.matchScore,
      ...result.breakdown,
    }
  } catch (err) {
    console.error(`[BrandAlert] resolveMatchScore failed icp=${icpId} consumer=${consumerId}:`, err)
    return null
  }
}
