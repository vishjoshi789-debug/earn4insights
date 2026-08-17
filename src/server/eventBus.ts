import 'server-only'

import { createRealtimeEvent, markEventProcessed } from '@/db/repositories/realtimeEventRepository'
import { dispatchToUsers, type NotificationTarget, type DispatchPayload } from '@/server/realtimeNotificationService'
import { getAdminUserIds } from '@/db/repositories/userRepository'
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
  CONSUMER_FEEDBACK_ADDRESSED:   'consumer.feedback.addressed',
  CONSUMER_SURVEY_COMPLETED:     'consumer.survey.completed',
  CONSUMER_PRODUCT_SEARCHED:     'consumer.product.searched',
  CONSUMER_REWARD_WITHDRAWN:     'consumer.reward.withdrawn',
  CONSUMER_PRODUCT_BROWSED:      'consumer.product.browsed',
  CONSUMER_COMMUNITY_POSTED:     'consumer.community.posted',
  // Influencer
  INFLUENCER_POST_PUBLISHED:     'influencer.post.published',
  INFLUENCER_CAMPAIGN_ACCEPTED:  'influencer.campaign.accepted',
  INFLUENCER_MILESTONE_COMPLETED:'influencer.milestone.completed',
  INFLUENCER_CAMPAIGN_INVITED:   'influencer.campaign.invited',
  INFLUENCER_REVIEW_RECEIVED:    'influencer.review.received',
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
  // Payment lifecycle
  PAYMENT_ORDER_CREATED:         'payment.order.created',
  PAYMENT_ESCROWED:              'payment.escrowed',
  PAYMENT_RELEASED:              'payment.released',
  PAYMENT_FAILED:                'payment.failed',
  PAYMENT_PAYOUT_INITIATED:      'payment.payout.initiated',
  PAYMENT_PAYOUT_COMPLETED:      'payment.payout.completed',
  PAYMENT_PAYOUT_FAILED:         'payment.payout.failed',
  CONSUMER_REWARD_REDEEMED:      'consumer.reward.redeemed',
  // Deals & Community
  DEAL_EXPIRED:                  'deal.expired',
  COMMUNITY_DEAL_FLAGGED:        'community.deal.flagged',
  COMMUNITY_DEAL_APPROVED:       'community.deal.approved',
  COMMUNITY_DEAL_REJECTED:       'community.deal.rejected',
  // Support system
  SUPPORT_TICKET_CREATED:        'support.ticket_created',
  SUPPORT_TICKET_UPDATED:        'support.ticket_updated',
  SUPPORT_TICKET_RESOLVED:       'support.ticket_resolved',
  SUPPORT_CHAT_ESCALATED:        'support.chat_escalated',
  SUPPORT_ADMIN_REPLY:           'support.admin_reply',
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
  feedbackId?:   string
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

    // ── Brand: survey created — handler removed.
    // "New survey" notifications now fan out DIRECTLY from
    // surveyService.createSurvey (email + in-app bell), sharing one
    // findIdealConsumers(productId) resolve. This handler self-resolved a
    // different (brand-ICP) audience, double-resolved, deref'd payload.brandId!
    // (throws on null), and used a broken /surveys/ CTA. Nothing emits
    // BRAND_SURVEY_CREATED anymore.

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

    // ── Consumer: feedback ADDRESSED → notify the consumer who wrote it
    //
    // This closes the loop: submit -> brand notified -> brand acts -> the
    // person who bothered to write it finds out. It is the only event on the
    // platform that travels brand -> consumer about that consumer's own words.
    //
    // The caller (the status PATCH route) has already:
    //   - confirmed the transition INTO 'addressed',
    //   - claimed the notification via the conditional resolution_notified_at
    //     update, so this runs at most once per feedback item, and
    //   - resolved consumerId from feedback.user_id, never from user_email.
    // So there is no identity work to redo here, only delivery.
    case PLATFORM_EVENTS.CONSUMER_FEEDBACK_ADDRESSED: {
      if (!payload.consumerId) break

      const productName = (payload.productName as string) || 'a product you reviewed'
      // Phase-2 slot (migration 034). `resolutionNote` is never populated in
      // v1 — the copy is shaped so the brand's own words drop in ahead of the
      // generic line without a rewrite when moderation is designed.
      const note = (payload.resolutionNote as string) || null
      const quoted = (payload.feedbackExcerpt as string) || null

      await dispatchToUsers([{ userId: payload.consumerId, role: 'consumer' }], {
        eventType,
        eventId,
        title: 'The brand acted on your feedback 🎉',
        body: note
          ? `${productName}: “${note}”`
          : `${productName} marked your feedback as addressed. Your input helped shape what happens next.`,
        ctaUrl: `/dashboard/my-feedback?highlight=${payload.feedbackId as string}`,
        type: 'feedback_addressed',
        actorId:    payload.actorId,
        actorRole:  'brand',
        entityType: 'feedback',
        entityId:   payload.feedbackId as string,
        metadata:   { productId: payload.productId, brandId: payload.brandId },

        // SERVICE MESSAGE, not personalization — the recipient is derived
        // solely from their own prior submission. See the field docs in
        // realtimeNotificationService.ts. Founder-approved, deliberately narrow.
        bypassPersonalizationConsent: true,

        emailSubject: `Your feedback on ${productName} was addressed`,
        // Quoting the consumer's own words back is most of the emotional
        // payload — they wrote this weeks ago and will not remember it. The
        // row is already in hand, so it costs nothing.
        emailBody: [
          `<p><strong>Good news — a brand acted on your feedback.</strong></p>`,
          quoted
            ? `<p>You told <strong>${productName}</strong>:</p><blockquote style="margin:12px 0;padding:8px 16px;border-left:3px solid #4F46E5;color:#444;">${quoted}</blockquote>`
            : `<p>Your feedback on <strong>${productName}</strong> has been marked as addressed.</p>`,
          note
            ? `<p>They replied: “${note}”</p>`
            : `<p>It has now been marked as addressed. Your input helped shape what happens next.</p>`,
          `<p><a href="https://www.earn4insights.com/dashboard/my-feedback?highlight=${payload.feedbackId as string}">See your feedback →</a></p>`,
        ].join('\n'),
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
        // Prefer the alert's own title/CTA. This path is the SOLE brand
        // notification for new feedback (see the note in
        // api/feedback/submit/route.ts §13), so a generic "Brand alert fired"
        // pointing at /dashboard/alerts would be a downgrade from what the
        // now-removed duplicate chain produced.
        title:  (payload.title as string) || 'Brand alert fired',
        body:   `${payload.body as string ?? 'A new brand alert was triggered.'}`,
        ctaUrl: (payload.ctaUrl as string) || '/dashboard/alerts',
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

    // ═══════════════════════════════════════════════════════════════════
    // ⚖️ CREATOR CARVE-OUT — `bypassPersonalizationConsent` on the
    //    transactional influencer events (founder-approved, 2026-08-17)
    // ═══════════════════════════════════════════════════════════════════
    //
    // Every influencer target below is `role: 'consumer'` — correctly, since a
    // dual-role creator (consumer who did "Become an Influencer") genuinely IS
    // a consumer. But `dispatchToUser` skips consumer-role targets lacking
    // `personalization` consent, and that gate is the ONLY thing `target.role`
    // controls. So a creator who declined personalization was silently
    // receiving NOTHING — including "your payment has been released".
    //
    // ⚠️ We did NOT fix this by changing the role to 'influencer'. That would
    // have disabled the gate wholesale and invisibly, including for
    // BRAND_CAMPAIGN_LAUNCHED, which fans out to 100 influencers selected from
    // an audience and SHOULD stay gated. The per-event flag is explicit and
    // auditable; a role change is neither.
    //
    // The test (from the resolution-loop carve-out): *is the recipient derived
    // from their own prior act, or selected from an audience?*
    //
    //   CARVED OUT — derived from their own act:
    //     content approved / rejected      (they submitted it)
    //     application accepted / rejected  (they applied)
    //     campaign invited                 (they published a marketplace profile)
    //     review received                  (they did the work being rated)
    //     payment escrowed / released      (their campaign, their money)
    //     payout initiated / completed / failed
    //
    //   STILL GATED — selected from an audience:
    //     BRAND_CAMPAIGN_LAUNCHED  → getActiveInfluencers(100), a broadcast
    //     INFLUENCER_POST_PUBLISHED (the ICP-matched consumer half)
    //
    // ✅ EXTENDED 2026-08-17 to the non-creator transactional events that were
    // flagged in the same audit: community post approved/rejected, the three
    // support-owner events, and reward-redemption confirmation (that last one
    // is MONEY — a consumer spending their own points and never learning
    // whether it worked). Search this file for
    // `bypassPersonalizationConsent: true` for the complete current set.
    //
    // The gate now applies ONLY to genuinely audience-selected events:
    // BRAND_PRODUCT_LAUNCHED, BRAND_CAMPAIGN_LAUNCHED, BRAND_MEMBER_ACTIVE,
    // BRAND_DISCOUNT_CREATED, DEAL_EXPIRED, and the consumer half of
    // INFLUENCER_POST_PUBLISHED — i.e. the marketing surface, which is what it
    // was always for.

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
        // TRANSACTIONAL — see the creator carve-out note above the payment
        // cases. They submitted this content; the outcome is theirs.
        bypassPersonalizationConsent: true,
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
        // TRANSACTIONAL — they submitted this content and need to act on it.
        bypassPersonalizationConsent: true,
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

    // ── Brand invited a creator to a campaign → notify the creator
    //
    // Previously SILENT. `inviteInfluencerToCampaign` wrote the invitation row
    // and emitted nothing, so a creator learned they had been invited only by
    // opening the app — the single most important creator moment on the
    // platform, with no notification behind it.
    //
    // Carved out of the consent gate: the creator published a marketplace
    // profile precisely to be found, and this is a direct 1:1 offer of paid
    // work with a decision attached — not an audience broadcast.
    case PLATFORM_EVENTS.INFLUENCER_CAMPAIGN_INVITED: {
      if (!payload.influencerId) break
      const influencerTarget: NotificationTarget = { userId: payload.influencerId, role: 'consumer' }
      await dispatchToUsers([influencerTarget], {
        eventType,
        eventId,
        title:  "You've been invited to a campaign 🎉",
        body:   `${payload.brandName ?? 'A brand'} invited you to "${payload.campaignTitle ?? 'a campaign'}"${
          payload.agreedRate ? ` at ${payload.agreedRate}` : ''
        }. Review the details and accept or decline.`,
        ctaUrl: payload.campaignId
          ? `/dashboard/influencer/campaigns/${payload.campaignId}`
          : '/dashboard/influencer/campaigns',
        type:   'campaign_invited',
        actorId:    payload.actorId,
        actorRole:  'brand',
        entityType: 'campaign',
        entityId:   payload.campaignId,
        metadata:   { brandId: payload.brandId, agreedRate: payload.agreedRate },
        bypassPersonalizationConsent: true,
        emailSubject: `You've been invited to "${payload.campaignTitle ?? 'a campaign'}"`,
      })
      break
    }

    // ── Brand reviewed a creator's work → notify the creator
    //
    // Also previously silent. A review affects the creator's standing on the
    // marketplace, so being told is not optional courtesy.
    case PLATFORM_EVENTS.INFLUENCER_REVIEW_RECEIVED: {
      if (!payload.influencerId) break
      const influencerTarget: NotificationTarget = { userId: payload.influencerId, role: 'consumer' }
      const rating = typeof payload.rating === 'number' ? payload.rating : null
      await dispatchToUsers([influencerTarget], {
        eventType,
        eventId,
        title:  rating ? `You received a ${rating}★ review` : 'You received a review',
        body:   `${payload.brandName ?? 'A brand'} reviewed your work on "${payload.campaignTitle ?? 'a campaign'}".`,
        ctaUrl: payload.campaignId
          ? `/dashboard/influencer/campaigns/${payload.campaignId}`
          : '/dashboard/influencer/campaigns',
        type:   'review_received',
        actorId:    payload.actorId,
        actorRole:  'brand',
        entityType: 'campaign',
        entityId:   payload.campaignId,
        metadata:   { rating, brandId: payload.brandId },
        // TRANSACTIONAL — a rating of work they performed.
        bypassPersonalizationConsent: true,
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
        // TRANSACTIONAL — they applied; this is the outcome of that act.
        bypassPersonalizationConsent: true,
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
        // TRANSACTIONAL — they applied; a rejection they never see leaves them
        // waiting on an answer that already exists.
        bypassPersonalizationConsent: true,
      })
      break
    }

    // ── Payment: order created → notify brand
    case PLATFORM_EVENTS.PAYMENT_ORDER_CREATED: {
      if (!payload.brandId) break
      const brandTarget: NotificationTarget = { userId: payload.brandId, role: 'brand' }
      await dispatchToUsers([brandTarget], {
        eventType,
        eventId,
        title:  'Payment order created',
        body:   `Payment order created for "${payload.campaignTitle ?? 'your campaign'}".`,
        ctaUrl: payload.campaignId ? `/dashboard/brand/campaigns/${payload.campaignId}` : '/dashboard/brand/campaigns',
        type:   'payment_order_created',
        entityType: 'campaign',
        entityId:   payload.campaignId,
      })
      break
    }

    // ── Payment: escrowed → notify brand + influencer
    case PLATFORM_EVENTS.PAYMENT_ESCROWED: {
      const targets: NotificationTarget[] = []
      if (payload.brandId) {
        targets.push({ userId: payload.brandId, role: 'brand' })
      }
      if (payload.influencerId) {
        targets.push({ userId: payload.influencerId, role: 'consumer' })
      }
      if (targets.length === 0) break
      // Notify brand
      if (payload.brandId) {
        await dispatchToUsers(
          [{ userId: payload.brandId, role: 'brand' }],
          {
            eventType,
            eventId,
            title:  'Payment confirmed',
            body:   `Payment secured in escrow for "${payload.campaignTitle ?? 'your campaign'}".`,
            ctaUrl: payload.campaignId ? `/dashboard/brand/campaigns/${payload.campaignId}` : '/dashboard/brand/campaigns',
            type:   'payment_escrowed',
            entityType: 'campaign',
            entityId:   payload.campaignId,
          }
        )
      }
      // Notify influencer
      if (payload.influencerId) {
        await dispatchToUsers(
          [{ userId: payload.influencerId, role: 'consumer' }],
          {
            eventType,
            eventId,
            title:  'Payment secured in escrow!',
            body:   `Payment held in escrow for "${payload.campaignTitle ?? 'a campaign'}". Complete milestones to unlock.`,
            ctaUrl: '/dashboard/influencer/campaigns',
            type:   'payment_escrowed',
            entityType: 'campaign',
            entityId:   payload.campaignId,
            // TRANSACTIONAL — money for THEIR campaign. Not marketing.
            bypassPersonalizationConsent: true,
          }
        )
      }
      break
    }

    // ── Payment: released → notify influencer
    case PLATFORM_EVENTS.PAYMENT_RELEASED: {
      if (!payload.influencerId) break
      const influencerTarget: NotificationTarget = { userId: payload.influencerId, role: 'consumer' }
      await dispatchToUsers([influencerTarget], {
        eventType,
        eventId,
        title:  'Payment released!',
        body:   `Payment released for "${payload.milestoneName ?? 'a milestone'}". Payout initiated to your account.`,
        ctaUrl: '/dashboard/influencer/payouts',
        type:   'payment_released',
        entityType: 'campaign',
        entityId:   payload.campaignId,
        metadata:   { milestoneName: payload.milestoneName },
        // TRANSACTIONAL — this is the creator's money. A consent preference
        // about personalization must never suppress "you have been paid".
        bypassPersonalizationConsent: true,
      })
      break
    }

    // ── Payment: failed → notify brand
    case PLATFORM_EVENTS.PAYMENT_FAILED: {
      if (!payload.brandId) break
      const brandTarget: NotificationTarget = { userId: payload.brandId, role: 'brand' }
      await dispatchToUsers([brandTarget], {
        eventType,
        eventId,
        title:  'Payment failed',
        body:   `Payment failed for "${payload.campaignTitle ?? 'your campaign'}". Please retry.`,
        ctaUrl: payload.campaignId ? `/dashboard/brand/campaigns/${payload.campaignId}` : '/dashboard/brand/campaigns',
        type:   'payment_failed',
        entityType: 'campaign',
        entityId:   payload.campaignId,
      })
      break
    }

    // ── Payout: initiated → notify recipient
    case PLATFORM_EVENTS.PAYMENT_PAYOUT_INITIATED: {
      if (!payload.recipientId) break
      const target: NotificationTarget = {
        userId: payload.recipientId as string,
        role: (payload.recipientType as string) === 'consumer' ? 'consumer' : 'consumer',
      }
      await dispatchToUsers([target], {
        eventType,
        eventId,
        title:  'Payout processing',
        body:   `Your payout is being processed. Expected 1–3 business days.`,
        ctaUrl: '/dashboard/influencer/payouts',
        type:   'payout_initiated',
        entityType: 'payout',
        entityId:   payload.payoutId as string,
        // TRANSACTIONAL — their money moving.
        bypassPersonalizationConsent: true,
      })
      break
    }

    // ── Payout: completed → notify recipient
    case PLATFORM_EVENTS.PAYMENT_PAYOUT_COMPLETED: {
      if (!payload.recipientId) break
      const target: NotificationTarget = {
        userId: payload.recipientId as string,
        role: 'consumer',
      }
      await dispatchToUsers([target], {
        eventType,
        eventId,
        title:  'Payment received!',
        body:   `Your payout has been credited to your account.`,
        ctaUrl: '/dashboard/influencer/payouts',
        type:   'payout_completed',
        entityType: 'payout',
        entityId:   payload.payoutId as string,
        // TRANSACTIONAL — their money arrived.
        bypassPersonalizationConsent: true,
      })
      break
    }

    // ── Payout: failed → notify recipient
    case PLATFORM_EVENTS.PAYMENT_PAYOUT_FAILED: {
      if (!payload.recipientId) break
      const target: NotificationTarget = {
        userId: payload.recipientId as string,
        role: 'consumer',
      }
      await dispatchToUsers([target], {
        eventType,
        eventId,
        title:  'Payout failed',
        body:   `Your payout could not be processed. Please contact support.`,
        ctaUrl: '/dashboard/influencer/payouts',
        type:   'payout_failed',
        entityType: 'payout',
        entityId:   payload.payoutId as string,
        metadata:   { failureReason: payload.failureReason },
        // TRANSACTIONAL — and the one they can least afford to miss: a failed
        // payout needs the creator to act (fix bank details, contact support).
        bypassPersonalizationConsent: true,
      })
      break
    }

    // ── Consumer: reward redeemed → notify consumer (+ brand if voucher)
    case PLATFORM_EVENTS.CONSUMER_REWARD_REDEEMED: {
      if (!payload.actorId) break
      const consumerTarget: NotificationTarget = { userId: payload.actorId, role: 'consumer' }
      await dispatchToUsers([consumerTarget], {
        eventType,
        eventId,
        title:  'Redemption confirmed!',
        body:   `You redeemed ${payload.points ?? ''} points for ${payload.redemptionType ?? 'a reward'}.`,
        ctaUrl: '/dashboard/rewards',
        type:   'reward_redeemed',
        entityType: 'reward',
        // TRANSACTIONAL — and this one is MONEY. A consumer spent their own
        // points; the confirmation that the redemption went through is a
        // receipt, not marketing. Without this they'd have no way to know
        // whether their points were consumed.
        bypassPersonalizationConsent: true,
      })
      // If voucher and linked to a brand, notify the brand too
      if (payload.redemptionType === 'voucher' && payload.brandId) {
        const brandTarget: NotificationTarget = { userId: payload.brandId, role: 'brand' }
        await dispatchToUsers([brandTarget], {
          eventType,
          eventId,
          title:  'Consumer redeemed a voucher',
          body:   `A consumer redeemed a discount voucher — strong engagement signal.`,
          ctaUrl: '/dashboard/analytics',
          type:   'reward_redeemed',
          entityType: 'brand',
          entityId:   payload.brandId,
        })
      }
      break
    }

    // ── Deal expired → notify consumers who saved it
    case PLATFORM_EVENTS.DEAL_EXPIRED: {
      // payload.dealSaverIds is an array of userIds who saved the deal
      const saverIds = (payload.dealSaverIds as string[]) ?? []
      if (saverIds.length > 0) {
        const targets: NotificationTarget[] = saverIds.map(id => ({ userId: id, role: 'consumer' }))
        await dispatchToUsers(targets, {
          eventType,
          eventId,
          title: 'Deal expired',
          body: `A deal you saved has expired: ${payload.dealTitle ?? 'Unknown deal'}`,
          ctaUrl: '/dashboard/deals',
          type: 'deal_expired',
          entityType: 'deal',
          entityId: payload.dealId as string,
          metadata: { brandId: payload.brandId },
        })
      }
      break
    }

    // ── Community deal post approved → notify author
    case PLATFORM_EVENTS.COMMUNITY_DEAL_APPROVED: {
      if (payload.actorId) {
        await dispatchToUsers([{ userId: payload.actorId, role: 'consumer' }], {
          eventType,
          eventId,
          title: 'Post approved!',
          body: `Your community deal post "${payload.postTitle ?? ''}" has been approved and is now live.`,
          ctaUrl: `/dashboard/community-deals/post/${payload.postId}`,
          type: 'community_deal_approved',
          entityType: 'community_deal_post',
          entityId: payload.postId as string,
          // TRANSACTIONAL — the outcome of moderation on THEIR own post.
          bypassPersonalizationConsent: true,
        })
      }
      break
    }

    // ── Community deal post rejected → notify author
    case PLATFORM_EVENTS.COMMUNITY_DEAL_REJECTED: {
      if (payload.actorId) {
        await dispatchToUsers([{ userId: payload.actorId, role: 'consumer' }], {
          eventType,
          eventId,
          title: 'Post rejected',
          body: `Your community deal post was rejected: ${payload.rejectionReason ?? 'See guidelines'}`,
          ctaUrl: '/dashboard/community-deals',
          type: 'community_deal_rejected',
          entityType: 'community_deal_post',
          entityId: payload.postId as string,
          // TRANSACTIONAL — a rejection they never see leaves them believing
          // their post is live when it isn't.
          bypassPersonalizationConsent: true,
        })
      }
      break
    }

    // ── Support: new ticket → notify all admins
    case PLATFORM_EVENTS.SUPPORT_TICKET_CREATED: {
      const adminIds = await getAdminUserIds()
      if (adminIds.length === 0) break
      const targets: NotificationTarget[] = adminIds.map((id) => ({ userId: id, role: 'admin' as const }))
      await dispatchToUsers(targets, {
        eventType,
        eventId,
        title: `New ticket from ${payload.userName ?? 'a user'}`,
        body: payload.subject as string ?? 'New support ticket opened',
        ctaUrl: `/admin/support/tickets/${payload.ticketId}`,
        type: 'support_ticket_created',
        entityType: 'support_ticket',
        entityId: (payload.ticketId as string) ?? null,
        metadata: {
          ticketNumber: payload.ticketNumber,
          userRole: payload.userRole,
          category: payload.category,
          priority: payload.priority,
        },
      })
      break
    }

    // ── Support: chat escalated → notify all admins (with chat context hint)
    case PLATFORM_EVENTS.SUPPORT_CHAT_ESCALATED: {
      const adminIds = await getAdminUserIds()
      if (adminIds.length === 0) break
      const targets: NotificationTarget[] = adminIds.map((id) => ({ userId: id, role: 'admin' as const }))
      await dispatchToUsers(targets, {
        eventType,
        eventId,
        title: 'Chat escalated to ticket',
        body: `AI couldn't resolve a chat from ${payload.userName ?? 'a user'}. Ticket ${payload.ticketNumber ?? ''} created.`,
        ctaUrl: `/admin/support/tickets/${payload.ticketId}`,
        type: 'support_chat_escalated',
        entityType: 'support_ticket',
        entityId: (payload.ticketId as string) ?? null,
        metadata: {
          ticketNumber: payload.ticketNumber,
          conversationId: payload.conversationId,
          messageCount: payload.messageCount,
        },
      })
      break
    }

    // ── Support: admin replied → notify ticket owner
    case PLATFORM_EVENTS.SUPPORT_ADMIN_REPLY: {
      if (!payload.userId) break
      const target: NotificationTarget = {
        userId: payload.userId as string,
        role: (payload.userRole as 'brand' | 'consumer' | 'admin' | undefined) ?? 'consumer',
      }
      await dispatchToUsers([target], {
        eventType,
        eventId,
        title: `New reply on ticket ${payload.ticketNumber ?? ''}`.trim(),
        body: 'Our team responded to your support request.',
        ctaUrl: `/support/tickets/${payload.ticketId}`,
        type: 'support_admin_reply',
        entityType: 'support_ticket',
        entityId: (payload.ticketId as string) ?? null,
        metadata: { ticketNumber: payload.ticketNumber },
        // TRANSACTIONAL — a reply to a ticket THEY opened. Suppressing this
        // means someone asks for help and never learns they got an answer.
        bypassPersonalizationConsent: true,
      })
      break
    }

    // ── Support: ticket status changed → notify owner (non-resolution)
    case PLATFORM_EVENTS.SUPPORT_TICKET_UPDATED: {
      if (!payload.userId) break
      const target: NotificationTarget = {
        userId: payload.userId as string,
        role: (payload.userRole as 'brand' | 'consumer' | 'admin' | undefined) ?? 'consumer',
      }
      await dispatchToUsers([target], {
        eventType,
        eventId,
        title: `Ticket ${payload.ticketNumber ?? ''} updated`.trim(),
        body: `Status changed to ${payload.toStatus ?? 'updated'}.`,
        ctaUrl: `/support/tickets/${payload.ticketId}`,
        type: 'support_ticket_updated',
        entityType: 'support_ticket',
        entityId: (payload.ticketId as string) ?? null,
        metadata: { fromStatus: payload.fromStatus, toStatus: payload.toStatus },
        // TRANSACTIONAL — status of their own ticket.
        bypassPersonalizationConsent: true,
      })
      break
    }

    // ── Support: ticket resolved → notify owner with rating prompt
    case PLATFORM_EVENTS.SUPPORT_TICKET_RESOLVED: {
      if (!payload.userId) break
      const target: NotificationTarget = {
        userId: payload.userId as string,
        role: (payload.userRole as 'brand' | 'consumer' | 'admin' | undefined) ?? 'consumer',
      }
      await dispatchToUsers([target], {
        eventType,
        eventId,
        title: `Ticket ${payload.ticketNumber ?? ''} resolved`.trim(),
        body: 'How did we do? Tap to rate your experience.',
        ctaUrl: `/support/tickets/${payload.ticketId}?rate=1`,
        type: 'support_ticket_resolved',
        entityType: 'support_ticket',
        entityId: (payload.ticketId as string) ?? null,
        metadata: { ticketNumber: payload.ticketNumber },
        // TRANSACTIONAL — resolution of their own ticket. ⚠️ Note this one
        // also carries a rating prompt; the carve-out is justified by the
        // resolution notice, not by the survey attached to it.
        bypassPersonalizationConsent: true,
      })
      break
    }

    default:
      console.warn(`[EventBus] No handler for event type: ${eventType}`)
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────

function resolveEntityType(eventType: string, payload: EventPayload): string | null {
  // Feedback events that name a specific row point AT that row. Checked first
  // because the generic rules below map anything mentioning feedback to
  // 'product', which is right for feedback.submitted (the brand cares which
  // product) but wrong for feedback.addressed (the audit trail should identify
  // the individual item that was resolved). Gated on feedbackId so
  // feedback.submitted, which carries none, keeps its existing behaviour.
  if (eventType.includes('feedback') && payload.feedbackId) return 'feedback'
  if (eventType.startsWith('support.'))      return 'support_ticket'
  if (eventType.startsWith('payment.payout')) return 'payout'
  if (eventType.startsWith('payment.'))      return 'campaign'
  if (eventType.includes('reward'))          return 'reward'
  if (eventType.includes('product'))         return 'product'
  if (eventType.includes('survey'))          return 'survey'
  if (eventType.includes('campaign'))        return 'campaign'
  if (eventType.includes('mention'))         return 'brand'
  if (eventType.includes('feedback'))        return 'product'
  if (eventType.startsWith('deal.'))         return 'deal'
  if (eventType.startsWith('community.deal')) return 'community_deal_post'
  return null
}

function resolveEntityId(eventType: string, payload: EventPayload): string | null {
  // Mirror of resolveEntityType — see the note there.
  if (eventType.includes('feedback') && payload.feedbackId) return payload.feedbackId as string
  if (eventType.startsWith('support.'))      return (payload.ticketId as string) ?? null
  if (eventType.startsWith('payment.payout')) return (payload.payoutId as string) ?? null
  if (eventType.startsWith('payment.'))      return payload.campaignId ?? null
  if (eventType.includes('reward'))          return payload.actorId ?? null
  if (eventType.includes('product'))         return payload.productId ?? null
  if (eventType.includes('survey'))          return payload.surveyId  ?? null
  if (eventType.includes('campaign'))        return payload.campaignId ?? null
  if (eventType.includes('mention'))         return payload.brandId  ?? null
  if (eventType.includes('feedback'))        return payload.productId ?? null
  if (eventType.startsWith('deal.'))         return (payload.dealId as string) ?? null
  if (eventType.startsWith('community.deal')) return (payload.postId as string) ?? null
  return null
}
