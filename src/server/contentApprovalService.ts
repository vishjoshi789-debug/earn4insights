/**
 * Content Approval Service
 *
 * Business logic for the content review workflow:
 * - Submit for review (influencer)
 * - Approve / reject (brand or admin)
 * - Resubmit rejected content (influencer)
 * - Auto-approve on SLA expiry (cron)
 *
 * All approval/rejection actions are:
 * - Logged to audit_log
 * - Emitted via eventBus for real-time notifications
 * - INFLUENCER_POST_PUBLISHED emitted only on approval
 */

import 'server-only'

import { getPostById } from '@/db/repositories/influencerContentPostRepository'
import {
  markPostPendingReview,
  markPostApproved,
  markPostRejected,
  markPostResubmitted,
  getCampaignForPost,
  isBrandCampaignOwner,
  logApprovalAction,
  getPostsApproachingSla,
  getPostsExceedingSla,
  hasReminder,
  createReminderRecord,
  markReminderSent,
  getPendingReminders,
} from '@/db/repositories/contentApprovalRepository'
import { emit, PLATFORM_EVENTS } from '@/server/eventBus'
import { db } from '@/db'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'

// ── Types ─────────────────────────────────────────────────────────

interface ServiceResult {
  success: boolean
  error?: string
  post?: any
}

// ── Submit for Review ─────────────────────────────────────────────

export async function submitForReview(
  postId: string,
  influencerId: string,
): Promise<ServiceResult> {
  const post = await getPostById(postId)
  if (!post) return { success: false, error: 'Post not found' }
  if (post.influencerId !== influencerId) return { success: false, error: 'Not your post' }
  if (post.status !== 'draft' && post.status !== 'rejected') {
    return { success: false, error: `Cannot submit post with status "${post.status}" for review` }
  }

  const updated = await markPostPendingReview(postId)

  // Emit notification to brand if campaign-linked
  if (post.campaignId) {
    const campaign = await getCampaignForPost(postId)
    if (campaign) {
      // Look up influencer name for notification
      const influencer = await db.query.users.findFirst({
        where: eq(users.id, influencerId),
      })

      emit(PLATFORM_EVENTS.BRAND_CONTENT_PENDING_REVIEW, {
        actorId: influencerId,
        brandId: campaign.brandId,
        campaignId: campaign.campaignId,
        campaignTitle: campaign.campaignTitle,
        postId,
        influencerId,
        influencerName: influencer?.name ?? undefined,
      }).catch(() => {})
    }
  }

  return { success: true, post: updated }
}

// ── Approve Content ───────────────────────────────────────────────

export async function approveContent(
  postId: string,
  reviewerUserId: string,
  reviewerRole: 'brand' | 'admin',
): Promise<ServiceResult> {
  const post = await getPostById(postId)
  if (!post) return { success: false, error: 'Post not found' }
  if (post.status !== 'pending_review') {
    return { success: false, error: `Cannot approve post with status "${post.status}"` }
  }

  // Brand must own the campaign
  if (reviewerRole === 'brand') {
    if (!post.campaignId) {
      return { success: false, error: 'Brand can only approve campaign-linked content' }
    }
    const owns = await isBrandCampaignOwner(reviewerUserId, post.campaignId)
    if (!owns) return { success: false, error: 'You do not own this campaign' }
  }

  const updated = await markPostApproved(postId, reviewerUserId)

  // Audit log
  await logApprovalAction({
    action: 'content_approved',
    postId,
    actorId: reviewerUserId,
    metadata: { campaignId: post.campaignId, influencerId: post.influencerId, reviewerRole },
  })

  // Get context for notifications
  const campaign = post.campaignId ? await getCampaignForPost(postId) : null
  const reviewer = await db.query.users.findFirst({ where: eq(users.id, reviewerUserId) })

  // Notify influencer: content approved
  emit(PLATFORM_EVENTS.INFLUENCER_CONTENT_APPROVED, {
    actorId: reviewerUserId,
    influencerId: post.influencerId,
    campaignId: post.campaignId ?? undefined,
    campaignTitle: campaign?.campaignTitle ?? undefined,
    brandName: reviewer?.name ?? undefined,
    brandId: campaign?.brandId ?? undefined,
    postId,
  }).catch(() => {})

  // Now that content is approved+published, emit INFLUENCER_POST_PUBLISHED
  // for consumer discovery (ICP-matched consumers notification)
  emit(PLATFORM_EVENTS.INFLUENCER_POST_PUBLISHED, {
    actorId: post.influencerId,
    postId,
    brandId: campaign?.brandId ?? post.brandId ?? undefined,
    campaignId: post.campaignId ?? undefined,
    brandName: reviewer?.name ?? undefined,
    title: post.title,
  }).catch(() => {})

  return { success: true, post: updated }
}

// ── Reject Content ────────────────────────────────────────────────

export async function rejectContent(
  postId: string,
  reviewerUserId: string,
  reason: string,
  reviewerRole: 'brand' | 'admin',
): Promise<ServiceResult> {
  if (!reason || reason.trim().length < 10) {
    return { success: false, error: 'Rejection reason must be at least 10 characters' }
  }

  const post = await getPostById(postId)
  if (!post) return { success: false, error: 'Post not found' }
  if (post.status !== 'pending_review') {
    return { success: false, error: `Cannot reject post with status "${post.status}"` }
  }

  // Brand must own the campaign
  if (reviewerRole === 'brand') {
    if (!post.campaignId) {
      return { success: false, error: 'Brand can only reject campaign-linked content' }
    }
    const owns = await isBrandCampaignOwner(reviewerUserId, post.campaignId)
    if (!owns) return { success: false, error: 'You do not own this campaign' }
  }

  const updated = await markPostRejected(postId, reviewerUserId, reason.trim())

  // Audit log
  await logApprovalAction({
    action: 'content_rejected',
    postId,
    actorId: reviewerUserId,
    metadata: { campaignId: post.campaignId, influencerId: post.influencerId, reason, reviewerRole },
  })

  // Notify influencer: content rejected
  const campaign = post.campaignId ? await getCampaignForPost(postId) : null
  emit(PLATFORM_EVENTS.INFLUENCER_CONTENT_REJECTED, {
    actorId: reviewerUserId,
    influencerId: post.influencerId,
    campaignId: post.campaignId ?? undefined,
    campaignTitle: campaign?.campaignTitle ?? undefined,
    postId,
    rejectionReason: reason.trim(),
  }).catch(() => {})

  return { success: true, post: updated }
}

// ── Resubmit Content ──────────────────────────────────────────────

export async function resubmitContent(
  postId: string,
  influencerId: string,
  updates: { title?: string; body?: string; mediaUrls?: string[] },
): Promise<ServiceResult> {
  const post = await getPostById(postId)
  if (!post) return { success: false, error: 'Post not found' }
  if (post.influencerId !== influencerId) return { success: false, error: 'Not your post' }
  if (post.status !== 'rejected') {
    return { success: false, error: 'Only rejected posts can be resubmitted' }
  }

  const updated = await markPostResubmitted(postId, updates)

  // Emit notification to brand if campaign-linked
  if (post.campaignId) {
    const campaign = await getCampaignForPost(postId)
    if (campaign) {
      const influencer = await db.query.users.findFirst({
        where: eq(users.id, influencerId),
      })

      emit(PLATFORM_EVENTS.BRAND_CONTENT_PENDING_REVIEW, {
        actorId: influencerId,
        brandId: campaign.brandId,
        campaignId: campaign.campaignId,
        campaignTitle: campaign.campaignTitle,
        postId,
        influencerId,
        influencerName: influencer?.name ?? undefined,
      }).catch(() => {})
    }
  }

  return { success: true, post: updated }
}

// ── SLA Auto-Approval (called by cron) ────────────────────────────

export async function processAutoApprovals(): Promise<{
  autoApproved: number
  reminders75: number
  reminders90: number
  escalations: number
}> {
  const stats = { autoApproved: 0, reminders75: 0, reminders90: 0, escalations: 0 }

  // ── 75% SLA reminders ──────────────────────────────────────────
  const posts75 = await getPostsApproachingSla(75)
  for (const post of posts75) {
    if (!post.campaignId || !post.brandId) continue
    const already = await hasReminder(post.id, '75_pct')
    if (already) continue

    const reminder = await createReminderRecord({
      postId: post.id,
      campaignId: post.campaignId,
      brandId: post.brandId,
      reminderType: '75_pct',
      scheduledAt: new Date(),
    })
    if (reminder) {
      await markReminderSent(reminder.id)
      stats.reminders75++
      console.log(`[ContentReview] 75% SLA reminder for post ${post.id}`)
    }
  }

  // ── 90% SLA urgent reminders ───────────────────────────────────
  const posts90 = await getPostsApproachingSla(90)
  for (const post of posts90) {
    if (!post.campaignId || !post.brandId) continue
    const already = await hasReminder(post.id, '90_pct')
    if (already) continue

    const reminder = await createReminderRecord({
      postId: post.id,
      campaignId: post.campaignId,
      brandId: post.brandId,
      reminderType: '90_pct',
      scheduledAt: new Date(),
    })
    if (reminder) {
      await markReminderSent(reminder.id)
      stats.reminders90++
      console.log(`[ContentReview] 90% SLA urgent reminder for post ${post.id}`)
    }
  }

  // ── 100% SLA: auto-approve or escalate ─────────────────────────
  const expired = await getPostsExceedingSla()
  for (const post of expired) {
    if (!post.campaignId || !post.brandId) continue

    if (post.autoApproveEnabled) {
      // Auto-approve
      const result = await approveContentAsSystem(post.id, post.campaignId)
      if (result.success) {
        stats.autoApproved++

        // Notify brand about auto-approval
        emit(PLATFORM_EVENTS.BRAND_CONTENT_AUTO_APPROVED, {
          actorId: 'system',
          brandId: post.brandId,
          campaignId: post.campaignId,
          campaignTitle: post.campaignTitle ?? undefined,
          postId: post.id,
          slaHours: post.reviewSlaHours,
        }).catch(() => {})

        console.log(`[ContentReview] Auto-approved post ${post.id} (SLA ${post.reviewSlaHours}h expired)`)
      }
    } else {
      // Escalation — create sla_expired reminder if not already sent
      const already = await hasReminder(post.id, 'sla_expired')
      if (!already) {
        const reminder = await createReminderRecord({
          postId: post.id,
          campaignId: post.campaignId,
          brandId: post.brandId,
          reminderType: 'sla_expired',
          scheduledAt: new Date(),
        })
        if (reminder) {
          await markReminderSent(reminder.id)
          stats.escalations++
          console.log(`[ContentReview] SLA expired escalation for post ${post.id}`)
        }
      }
    }
  }

  return stats
}

// ── Internal: system auto-approve ────────────────────────────────

async function approveContentAsSystem(
  postId: string,
  campaignId: string,
): Promise<ServiceResult> {
  const post = await getPostById(postId)
  if (!post) return { success: false, error: 'Post not found' }
  if (post.status !== 'pending_review') return { success: false, error: 'Not pending review' }

  const updated = await markPostApproved(postId, 'system')

  // Audit log
  await logApprovalAction({
    action: 'content_auto_approved',
    postId,
    actorId: 'system',
    metadata: { campaignId, influencerId: post.influencerId },
  })

  // Notify influencer: content approved
  const campaign = await getCampaignForPost(postId)
  emit(PLATFORM_EVENTS.INFLUENCER_CONTENT_APPROVED, {
    actorId: 'system',
    influencerId: post.influencerId,
    campaignId: post.campaignId ?? undefined,
    campaignTitle: campaign?.campaignTitle ?? undefined,
    brandName: 'System (auto-approved)',
    postId,
  }).catch(() => {})

  // Emit INFLUENCER_POST_PUBLISHED for consumer discovery
  emit(PLATFORM_EVENTS.INFLUENCER_POST_PUBLISHED, {
    actorId: post.influencerId,
    postId,
    brandId: campaign?.brandId ?? post.brandId ?? undefined,
    campaignId: post.campaignId ?? undefined,
    title: post.title,
  }).catch(() => {})

  return { success: true, post: updated }
}
