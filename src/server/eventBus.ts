import 'server-only'

import { createRealtimeEvent, markEventProcessed } from '@/db/repositories/realtimeEventRepository'
import { dispatchToUsers, type NotificationTarget, type DispatchPayload } from '@/server/realtimeNotificationService'
import { getProductById } from '@/db/repositories/productRepository'
import { getTopMatchesForIcp } from '@/db/repositories/icpRepository'
import { db } from '@/db'
import { users, brandIcps, icpMatchScores } from '@/db/schema'
import { eq, and, gte, inArray } from 'drizzle-orm'

// ── Platform event registry ────────────────────────────────────────────────

export const PLATFORM_EVENTS = {
  // Brand
  BRAND_PRODUCT_LAUNCHED:        'brand.product.launched',
  BRAND_SURVEY_CREATED:          'brand.survey.created',
  BRAND_CAMPAIGN_LAUNCHED:       'brand.campaign.launched',
  BRAND_MEMBER_ACTIVE:           'brand.member.active',
  BRAND_DISCOUNT_CREATED:        'brand.discount.created',
  BRAND_ALERT_FIRED:             'brand.alert.fired',
  // Consumer
  CONSUMER_FEEDBACK_SUBMITTED:   'consumer.feedback.submitted',
  CONSUMER_SURVEY_COMPLETED:     'consumer.survey.completed',
  CONSUMER_PRODUCT_SEARCHED:     'consumer.product.searched',
  CONSUMER_REWARD_WITHDRAWN:     'consumer.reward.withdrawn',
  CONSUMER_PRODUCT_BROWSED:      'consumer.product.browsed',
  CONSUMER_COMMUNITY_POSTED:     'consumer.community.posted',
  // Influencer
  INFLUENCER_POST_PUBLISHED:     'influencer.post.published',
  INFLUENCER_CAMPAIGN_ACCEPTED:  'influencer.campaign.accepted',
  INFLUENCER_MILESTONE_COMPLETED:'influencer.milestone.completed',
  // Content approval
  BRAND_CONTENT_PENDING_REVIEW:  'brand.content.pending_review',
  INFLUENCER_CONTENT_APPROVED:   'influencer.content.approved',
  INFLUENCER_CONTENT_REJECTED:   'influencer.content.rejected',
  BRAND_CONTENT_AUTO_APPROVED:   'brand.content.auto_approved',
  // Marketplace applications
  INFLUENCER_CAMPAIGN_APPLIED:   'influencer.campaign.applied',
  BRAND_APPLICATION_ACCEPTED:    'brand.application.accepted',
  BRAND_APPLICATION_REJECTED:    'brand.application.rejected',
  // Social
  SOCIAL_MENTION_DETECTED:       'social.mention.detected',
} as const

export type PlatformEventType = typeof PLATFORM_EVENTS[keyof typeof PLATFORM_EVENTS]

// ── Event payload types ───────────────────────────────────────────────────

export interface EventPayload {
  actorId?:      string
  actorRole?:    'brand' | 'consumer' | 'admin'
  productId?:    string
  productName?:  string
  surveyId?:     string
  surveyTitle?:  string
  campaignId?:   string
  campaignTitle?:string
  brandId?:      string
  brandName?:    string
  consumerId?:   string
  consumerName?: string
  influencerId?: string
  mentionId?:    string
  mentionText?:  string
  platform?:     string
  // ICP targeting
  icpId?:        string
  minMatchScore?: number
  // Arbitrary extra data
  [key: string]: unknown
}

// ── Target resolution helpers ─────────────────────────────────────────────

/**
 * Get the owner (brand) of a product.
 */
async function getProductOwner(productId: string): Promise<NotificationTarget | null> {
  const product = await getProductById(productId)
  if (!product?.ownerId) return null
  return { userId: product.ownerId, role: 'brand' }
}

/**
 * Get consumers who match an ICP above a minimum score.
 * Uses cached icp_match_scores — no re-scoring at event time.
 */
async function getMatchingConsumers(
  icpId: string,
  minScore = 60
): Promise<NotificationTarget[]> {
  const matches = await getTopMatchesForIcp(icpId, { minScore, limit: 200 })
  return matches.map(m => ({ userId: m.consumerId, role: 'consumer' as const }))
}

/**
 * Get all active brand ICPs and find their top-matching consumers.
 * Used for product.launched / survey.created where we notify matched consumers.
 */
async function getConsumersForBrandViaIcps(
  brandId: string,
  minScore = 60
): Promise<NotificationTarget[]> {
  // Get all ICPs owned by this brand
  const icps = await db
    .select({ id: brandIcps.id })
    .from(brandIcps)
    .where(eq(brandIcps.brandId, brandId))

  if (icps.length === 0) return []

  const icpIds = icps.map(i => i.id)

  // Get distinct consumers who match any of this brand's ICPs
  const matches = await db
    .select({ consumerId: icpMatchScores.consumerId })
    .from(icpMatchScores)
    .where(
      and(
        inArray(icpMatchScores.icpId, icpIds),
        eq(icpMatchScores.isStale, false),
        gte(icpMatchScores.matchScore, minScore)
      )
    )

  // Deduplicate consumers (may match multiple ICPs)
  const seen = new Set<string>()
  const targets: NotificationTarget[] = []
  for (const m of matches) {
    if (!seen.has(m.consumerId)) {
      seen.add(m.consumerId)
      targets.push({ userId: m.consumerId, role: 'consumer' })
    }
  }
  return targets
}

/**
 * Get all active influencers who might be relevant to a brand campaign.
 * For campaign.launched we notify influencers who have at least a profile.
 */
async function getActiveInfluencers(limit = 100): Promise<NotificationTarget[]> {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.isInfluencer, true))
    .limit(limit)

  return rows.map(r => ({ userId: r.id, role: 'consumer' as const }))
}

// ── Main emit function ────────────────────────────────────────────────────

/**
 * Emit a platform event.
 *
 * This is the single entry point for all real-time events:
 *   1. Write audit record to realtime_events
 *   2. Resolve notification targets based on event type
 *   3. Dispatch to each target via realtimeNotificationService
 *   4. Mark audit record as processed
 *
 * Never throws — all errors are caught and logged.
 * Call fire-and-forget from API routes: don't await (or await if you need result).
 */
export async function emit(
  eventType: PlatformEventType,
  payload: EventPayload
): Promise<void> {
  let eventId: string | undefined

  try {
    // ── 1. Audit record ──────────────────────────────────────────────
    const event = await createRealtimeEvent({
      eventType,
      actorId:          payload.actorId ?? null,
      actorRole:        payload.actorRole ?? null,
      targetEntityType: resolveEntityType(eventType, payload),
      targetEntityId:   resolveEntityId(eventType, payload),
      payload:          payload as Record<string, unknown>,
      icpFilterApplied: !!(payload.icpId || payload.brandId),
      processedAt:      null,
    })
    eventId = event.id

    // ── 2. Resolve targets + build notification ──────────────────────
    await routeEvent(eventType, payload, eventId)

    // ── 3. Mark processed ────────────────────────────────────────────
    if (eventId) await markEventProcessed(eventId)

  } catch (err) {
    // Event bus failures must never break the calling API route
    console.error(`[EventBus] Failed to emit "${eventType}":`, err)
  }
}

// ── Event routing table ───────────────────────────────────────────────────

async function routeEvent(
  eventType: PlatformEventType,
  payload: EventPayload,
  eventId: string
): Promise<void> {

  switch (eventType) {

    // ── Brand: product launched → notify matched consumers + influencers
    case PLATFORM_EVENTS.BRAND_PRODUCT_LAUNCHED: {
      const targets = await getConsumersForBrandViaIcps(payload.brandId!, 60)
      await dispatchToUsers(targets, {
        eventType,
        eventId,
        title:  `New product: ${payload.productName ?? 'Untitled'}`,
        body:   `${payload.brandName ?? 'A brand you follow'} just launched a new product. Be one of the first to review it.`,
        ctaUrl: payload.productId ? `/products/${payload.productId}` : '/discover',
        type:   'product_launched',
        entityType: 'product',
        entityId:   payload.productId,
        metadata:   { brandId: payload.brandId },
      })
      break
    }

    // ── Brand: survey created → notify matched consumers
    case PLATFORM_EVENTS.BRAND_SURVEY_CREATED: {
      const targets = await getConsumersForBrandViaIcps(payload.brandId!, 50)
      await dispatchToUsers(targets, {
        eventType,
        eventId,
        title:  `New survey: ${payload.surveyTitle ?? 'Earn rewards'}`,
        body:   `A new survey is waiting for you. Complete it to earn points.`,
        ctaUrl: payload.surveyId ? `/surveys/${payload.surveyId}` : '/dashboard',
        type:   'survey_available',
        entityType: 'survey',
        entityId:   payload.surveyId,
      })
      break
    }

    // ── Brand: campaign launched → notify active influencers
    case PLATFORM_EVENTS.BRAND_CAMPAIGN_LAUNCHED: {
      const targets = await getActiveInfluencers(100)
      await dispatchToUsers(targets, {
        eventType,
        eventId,
        title:  `New campaign: ${payload.campaignTitle ?? 'Brand campaign'}`,
        body:   `${payload.brandName ?? 'A brand'} launched a new influencer campaign. Check your campaigns for an invitation.`,
        ctaUrl: '/dashboard/influencer/campaigns',
        type:   'campaign_available',
        entityType: 'campaign',
        entityId:   payload.campaignId,
      })
      break
    }

    // ── Consumer: feedback submitted → notify product owner (brand)
    case PLATFORM_EVENTS.CONSUMER_FEEDBACK_SUBMITTED: {
      if (!payload.productId) break
      const target = await getProductOwner(payload.productId)
      if (!target) break
      await dispatchToUsers([target], {
        eventType,
        eventId,
        title:  'New feedback received',
        body:   `A consumer submitted feedback on ${payload.productName ?? 'your product'}.`,
        ctaUrl: payload.productId ? `/dashboard/feedback?product=${payload.productId}` : '/dashboard/feedback',
        type:   'feedback_received',
        actorId:    payload.actorId,
        actorRole:  payload.actorRole,
        entityType: 'product',
        entityId:   payload.productId,
      })
      break
    }

    // ── Consumer: survey completed → notify survey owner (brand)
    case PLATFORM_EVENTS.CONSUMER_SURVEY_COMPLETED: {
      if (!payload.brandId) break
      const target: NotificationTarget = { userId: payload.brandId, role: 'brand' }
      await dispatchToUsers([target], {
        eventType,
        eventId,
        title:  'Survey response received',
        body:   `A consumer completed "${payload.surveyTitle ?? 'your survey'}".`,
        ctaUrl: payload.surveyId ? `/dashboard/surveys/${payload.surveyId}` : '/dashboard/surveys',
        type:   'survey_completed',
        actorId:    payload.actorId,
        entityType: 'survey',
        entityId:   payload.surveyId,
      })
      break
    }

    // ── Consumer: browsed or searched → notify brand (intent signal)
    case PLATFORM_EVENTS.CONSUMER_PRODUCT_BROWSED:
    case PLATFORM_EVENTS.CONSUMER_PRODUCT_SEARCHED: {
      if (!payload.productId) break
      const target = await getProductOwner(payload.productId)
      if (!target) break
      await dispatchToUsers([target], {
        eventType,
        eventId,
        title:  eventType === PLATFORM_EVENTS.CONSUMER_PRODUCT_BROWSED
          ? 'Consumer viewing your product'
          : 'Consumer searched for your product',
        body:   `A consumer is showing interest in ${payload.productName ?? 'your product'}.`,
        ctaUrl: '/dashboard/analytics',
        type:   'intent_signal',
        entityType: 'product',
        entityId:   payload.productId,
      })
      break
    }

    // ── Consumer: community post → notify brand + subscribed influencers
    case PLATFORM_EVENTS.CONSUMER_COMMUNITY_POSTED: {
      if (payload.productId) {
        const target = await getProductOwner(payload.productId)
        if (target) {
          await dispatchToUsers([target], {
            eventType,
            eventId,
            title:  'New community post about your product',
            body:   `A consumer posted in the community about ${payload.productName ?? 'your product'}.`,
            ctaUrl: '/dashboard/community',
            type:   'community_post',
            entityType: 'product',
            entityId:   payload.productId,
          })
        }
      }
      break
    }

    // ── Influencer: post published → notify matched consumers + brand
    case PLATFORM_EVENTS.INFLUENCER_POST_PUBLISHED: {
      // Notify the brand if this post is linked to a campaign
      if (payload.brandId) {
        const brandTarget: NotificationTarget = { userId: payload.brandId, role: 'brand' }
        await dispatchToUsers([brandTarget], {
          eventType,
          eventId,
          title:  'Influencer published a post',
          body:   `An influencer published content for your campaign "${payload.campaignTitle ?? 'Unknown'}"`,
          ctaUrl: payload.campaignId ? `/dashboard/brand/campaigns/${payload.campaignId}` : '/dashboard/brand/campaigns',
          type:   'influencer_post',
          entityType: 'campaign',
          entityId:   payload.campaignId,
        })

        // Also notify ICP-matched consumers so they discover relevant influencer content
        const consumerTargets = await getConsumersForBrandViaIcps(payload.brandId, 60)
        if (consumerTargets.length > 0) {
          await dispatchToUsers(consumerTargets, {
            eventType,
            eventId,
            title:  'New content from an influencer you may like',
            body:   `An influencer published content related to ${payload.brandName ?? 'a brand you follow'}.`,
            ctaUrl: payload.campaignId ? `/dashboard/brand/campaigns/${payload.campaignId}` : '/discover',
            type:   'influencer_content',
            entityType: 'campaign',
            entityId:   payload.campaignId,
            metadata:   { brandId: payload.brandId, influencerId: payload.influencerId },
          })
        }
      }
      break
    }

    // ── Influencer: campaign accepted → notify brand
    case PLATFORM_EVENTS.INFLUENCER_CAMPAIGN_ACCEPTED: {
      if (!payload.brandId) break
      const brandTarget: NotificationTarget = { userId: payload.brandId, role: 'brand' }
      await dispatchToUsers([brandTarget], {
        eventType,
        eventId,
        title:  'Influencer accepted your campaign',
        body:   `An influencer accepted the invitation for "${payload.campaignTitle ?? 'your campaign'}".`,
        ctaUrl: payload.campaignId ? `/dashboard/brand/campaigns/${payload.campaignId}` : '/dashboard/brand/campaigns',
        type:   'campaign_accepted',
        entityType: 'campaign',
        entityId:   payload.campaignId,
      })
      break
    }

    // ── Influencer: milestone completed → notify brand
    case PLATFORM_EVENTS.INFLUENCER_MILESTONE_COMPLETED: {
      if (!payload.brandId) break
      const brandTarget: NotificationTarget = { userId: payload.brandId, role: 'brand' }
      await dispatchToUsers([brandTarget], {
        eventType,
        eventId,
        title:  'Milestone submitted for review',
        body:   `An influencer submitted a milestone for "${payload.campaignTitle ?? 'your campaign'}". Review and approve to release payment.`,
        ctaUrl: payload.campaignId ? `/dashboard/brand/campaigns/${payload.campaignId}` : '/dashboard/brand/campaigns',
        type:   'milestone_submitted',
        entityType: 'campaign',
        entityId:   payload.campaignId,
      })
      break
    }

    // ── Social: mention detected → notify entity owner
    case PLATFORM_EVENTS.SOCIAL_MENTION_DETECTED: {
      if (!payload.brandId) break
      const brandTarget: NotificationTarget = { userId: payload.brandId, role: 'brand' }
      await dispatchToUsers([brandTarget], {
        eventType,
        eventId,
        title:  `New ${payload.platform ?? 'social'} mention`,
        body:   payload.mentionText
          ? `"${payload.mentionText.slice(0, 120)}${payload.mentionText.length > 120 ? '…' : ''}"`
          : 'Your brand was mentioned on social media.',
        ctaUrl: '/dashboard/social',
        type:   'social_mention',
        entityType: 'brand',
        entityId:   payload.brandId,
        metadata:   { platform: payload.platform, mentionId: payload.mentionId },
      })
      break
    }

    // ── Brand: alert fired (ICP-gated alert → notify brand) ──────────
    case PLATFORM_EVENTS.BRAND_ALERT_FIRED: {
      if (!payload.brandId) break
      const brandTarget: NotificationTarget = { userId: payload.brandId, role: 'brand' }
      await dispatchToUsers([brandTarget], {
        eventType,
        eventId,
        title:  'Brand alert fired',
        body:   `${payload.body as string ?? 'A new brand alert was triggered.'}`,
        ctaUrl: '/dashboard/alerts',
        type:   'brand_alert',
        entityType: payload.entityType as string | undefined,
        entityId:   payload.entityId as string | undefined,
      })
      break
    }

    // ── Brand: member active → notify community members via ICP
    case PLATFORM_EVENTS.BRAND_MEMBER_ACTIVE: {
      if (!payload.brandId) break
      const targets = await getConsumersForBrandViaIcps(payload.brandId, 50)
      if (targets.length === 0) break
      await dispatchToUsers(targets, {
        eventType,
        eventId,
        title:  `${payload.brandName ?? 'A brand'} is active now`,
        body:   'A brand you follow is currently active. Check out their latest updates.',
        ctaUrl: payload.brandId ? `/brands/${payload.brandId}` : '/discover',
        type:   'brand_active',
        entityType: 'brand',
        entityId:   payload.brandId,
        metadata:   { brandId: payload.brandId },
      })
      break
    }

    // ── Brand: discount created → notify interested consumers via ICP
    case PLATFORM_EVENTS.BRAND_DISCOUNT_CREATED: {
      if (!payload.brandId) break
      const targets = await getConsumersForBrandViaIcps(payload.brandId, 50)
      if (targets.length === 0) break
      await dispatchToUsers(targets, {
        eventType,
        eventId,
        title:  `New discount from ${payload.brandName ?? 'a brand you follow'}`,
        body:   payload.productName
          ? `A discount is available on ${payload.productName}. Claim it before it expires.`
          : 'A new discount is available from a brand you follow.',
        ctaUrl: payload.productId ? `/products/${payload.productId}` : '/discover',
        type:   'discount_available',
        entityType: payload.productId ? 'product' : 'brand',
        entityId:   payload.productId ?? payload.brandId,
        metadata:   { brandId: payload.brandId },
      })
      break
    }

    // ── Consumer: reward withdrawn → notify brand (loyalty signal)
    case PLATFORM_EVENTS.CONSUMER_REWARD_WITHDRAWN: {
      if (!payload.brandId) break
      const brandTarget: NotificationTarget = { userId: payload.brandId, role: 'brand' }
      await dispatchToUsers([brandTarget], {
        eventType,
        eventId,
        title:  'Consumer redeemed a reward',
        body:   `A consumer redeemed a reward linked to ${payload.productName ?? 'your product'} — strong loyalty signal.`,
        ctaUrl: '/dashboard/analytics',
        type:   'reward_redeemed',
        actorId:    payload.actorId,
        entityType: payload.productId ? 'product' : 'brand',
        entityId:   payload.productId ?? payload.brandId,
      })
      break
    }

    // ── Content approval: pending review → notify brand
    case PLATFORM_EVENTS.BRAND_CONTENT_PENDING_REVIEW: {
      if (!payload.brandId) break
      const brandTarget: NotificationTarget = { userId: payload.brandId, role: 'brand' }
      await dispatchToUsers([brandTarget], {
        eventType,
        eventId,
        title:  'New content awaiting review',
        body:   `${payload.influencerName ?? 'An influencer'} submitted content for "${payload.campaignTitle ?? 'your campaign'}". Review and approve to publish.`,
        ctaUrl: '/dashboard/brand/content-review',
        type:   'content_pending_review',
        entityType: 'content_post',
        entityId:   payload.postId as string,
        metadata:   { campaignId: payload.campaignId, influencerId: payload.influencerId },
      })
      break
    }

    // ── Content approval: approved → notify influencer
    case PLATFORM_EVENTS.INFLUENCER_CONTENT_APPROVED: {
      if (!payload.influencerId) break
      const influencerTarget: NotificationTarget = { userId: payload.influencerId, role: 'consumer' }
      await dispatchToUsers([influencerTarget], {
        eventType,
        eventId,
        title:  'Your content was approved!',
        body:   `Your content for "${payload.campaignTitle ?? 'a campaign'}" by ${payload.brandName ?? 'a brand'} has been approved and published.`,
        ctaUrl: '/dashboard/influencer/content',
        type:   'content_approved',
        entityType: 'content_post',
        entityId:   payload.postId as string,
        metadata:   { campaignId: payload.campaignId, brandId: payload.brandId },
      })
      break
    }

    // ── Content approval: rejected → notify influencer
    case PLATFORM_EVENTS.INFLUENCER_CONTENT_REJECTED: {
      if (!payload.influencerId) break
      const influencerTarget: NotificationTarget = { userId: payload.influencerId, role: 'consumer' }
      await dispatchToUsers([influencerTarget], {
        eventType,
        eventId,
        title:  'Your content needs revision',
        body:   `Your content for "${payload.campaignTitle ?? 'a campaign'}" was not approved. Reason: ${payload.rejectionReason ?? 'See details'}`,
        ctaUrl: '/dashboard/influencer/content',
        type:   'content_rejected',
        entityType: 'content_post',
        entityId:   payload.postId as string,
        metadata:   { campaignId: payload.campaignId, brandId: payload.brandId, reason: payload.rejectionReason },
      })
      break
    }

    // ── Content approval: auto-approved → notify brand
    case PLATFORM_EVENTS.BRAND_CONTENT_AUTO_APPROVED: {
      if (!payload.brandId) break
      const brandTarget: NotificationTarget = { userId: payload.brandId, role: 'brand' }
      await dispatchToUsers([brandTarget], {
        eventType,
        eventId,
        title:  'Content auto-approved per SLA',
        body:   `Content for "${payload.campaignTitle ?? 'your campaign'}" was auto-approved after ${payload.slaHours ?? ''}hr SLA expired.`,
        ctaUrl: '/dashboard/brand/content-review',
        type:   'content_auto_approved',
        entityType: 'content_post',
        entityId:   payload.postId as string,
        metadata:   { campaignId: payload.campaignId, slaHours: payload.slaHours },
      })
      break
    }

    // ── Marketplace: influencer applied → notify brand
    case PLATFORM_EVENTS.INFLUENCER_CAMPAIGN_APPLIED: {
      if (!payload.brandId) break
      const brandTarget: NotificationTarget = { userId: payload.brandId, role: 'brand' }
      await dispatchToUsers([brandTarget], {
        eventType,
        eventId,
        title:  'New campaign application',
        body:   `${payload.influencerName ?? 'An influencer'} applied to "${payload.campaignTitle ?? 'your campaign'}" with a rate of ${payload.proposedRate ? `${payload.proposedRate}` : 'N/A'}.`,
        ctaUrl: payload.campaignId ? `/dashboard/brand/campaigns/${payload.campaignId}` : '/dashboard/brand/campaigns',
        type:   'campaign_application',
        entityType: 'campaign',
        entityId:   payload.campaignId,
        metadata:   { influencerId: payload.influencerId, proposalPreview: payload.proposalPreview },
      })
      break
    }

    // ── Marketplace: brand accepted application → notify influencer
    case PLATFORM_EVENTS.BRAND_APPLICATION_ACCEPTED: {
      if (!payload.influencerId) break
      const influencerTarget: NotificationTarget = { userId: payload.influencerId, role: 'consumer' }
      await dispatchToUsers([influencerTarget], {
        eventType,
        eventId,
        title:  'Application accepted!',
        body:   `Your application to "${payload.campaignTitle ?? 'a campaign'}" has been accepted. Check the campaign details for next steps.`,
        ctaUrl: payload.campaignId ? `/dashboard/influencer/campaigns/${payload.campaignId}` : '/dashboard/influencer/marketplace',
        type:   'application_accepted',
        entityType: 'campaign',
        entityId:   payload.campaignId,
        metadata:   { brandId: payload.brandId },
      })
      break
    }

    // ── Marketplace: brand rejected application → notify influencer
    case PLATFORM_EVENTS.BRAND_APPLICATION_REJECTED: {
      if (!payload.influencerId) break
      const influencerTarget: NotificationTarget = { userId: payload.influencerId, role: 'consumer' }
      await dispatchToUsers([influencerTarget], {
        eventType,
        eventId,
        title:  'Application update',
        body:   payload.brandResponse
          ? `Your application to "${payload.campaignTitle ?? 'a campaign'}" was not accepted. Response: ${(payload.brandResponse as string).slice(0, 120)}`
          : `Your application to "${payload.campaignTitle ?? 'a campaign'}" was not accepted.`,
        ctaUrl: '/dashboard/influencer/marketplace',
        type:   'application_rejected',
        entityType: 'campaign',
        entityId:   payload.campaignId,
        metadata:   { brandId: payload.brandId, brandResponse: payload.brandResponse },
      })
      break
    }

    default:
      console.warn(`[EventBus] No handler for event type: ${eventType}`)
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────

function resolveEntityType(eventType: string, payload: EventPayload): string | null {
  if (eventType.includes('product'))  return 'product'
  if (eventType.includes('survey'))   return 'survey'
  if (eventType.includes('campaign')) return 'campaign'
  if (eventType.includes('mention'))  return 'brand'
  if (eventType.includes('feedback')) return 'product'
  return null
}

function resolveEntityId(eventType: string, payload: EventPayload): string | null {
  if (eventType.includes('product'))  return payload.productId ?? null
  if (eventType.includes('survey'))   return payload.surveyId  ?? null
  if (eventType.includes('campaign')) return payload.campaignId ?? null
  if (eventType.includes('mention'))  return payload.brandId  ?? null
  if (eventType.includes('feedback')) return payload.productId ?? null
  return null
}
