/**
 * Deals Moderation Service
 *
 * Admin/cron moderation for community deal posts:
 * - Admin queue: pending posts, approve/reject, bulk moderate
 * - Auto-moderation: auto-approve brand posts, upvote milestone
 * - Flagged content: review + resolve flags, hide content
 * - Deal expiry: mark expired deals, notify savers
 * - Duplicate promo code detection
 */

import 'server-only'

import {
  getPostById,
  updatePost,
  getPendingPosts as getPendingPostsRepo,
  getAutoApprovablePosts,
  getFlaggedContentIds,
  getPostsWithUpvoteMilestone,
  updateCommentStatus,
} from '@/db/repositories/communityDealsRepository'
import {
  getExpiredActiveDeals,
  markDealsExpired,
  getConsumersWhoSavedDeal,
} from '@/db/repositories/dealsRepository'
import { awardPoints } from '@/server/pointsService'
import { emit, PLATFORM_EVENTS } from '@/server/eventBus'

// ── Admin: Pending Queue ─────────────────────────────────────────

export async function getPendingPosts(cursor?: string, limit = 20) {
  return getPendingPostsRepo(cursor, limit)
}

// ── Admin: Approve Post ──────────────────────────────────────────

export async function approvePost(postId: string, moderatorId: string) {
  const post = await getPostById(postId)
  if (!post) throw new Error('Post not found')
  if (post.status === 'approved') return post

  const updated = await updatePost(postId, {
    status: 'approved',
  } as any)

  return updated
}

// ── Admin: Reject Post ───────────────────────────────────────────

export async function rejectPost(postId: string, moderatorId: string, reason: string) {
  const post = await getPostById(postId)
  if (!post) throw new Error('Post not found')

  const updated = await updatePost(postId, {
    status: 'rejected',
    rejectionReason: reason,
    moderationNote: `Rejected by ${moderatorId}`,
  } as any)

  return updated
}

// ── Admin: Bulk Moderate ─────────────────────────────────────────

export async function bulkModerate(
  postIds: string[],
  action: 'approve' | 'reject',
  moderatorId: string,
  reason?: string
) {
  const results: { id: string; status: string }[] = []

  for (const id of postIds) {
    try {
      if (action === 'approve') {
        await approvePost(id, moderatorId)
        results.push({ id, status: 'approved' })
      } else {
        await rejectPost(id, moderatorId, reason ?? 'Bulk rejected by admin')
        results.push({ id, status: 'rejected' })
      }
    } catch (err: any) {
      results.push({ id, status: `error: ${err.message}` })
    }
  }

  return results
}

// ── Admin: Hide Content ──────────────────────────────────────────

export async function hideContent(contentType: 'post' | 'comment', contentId: string) {
  if (contentType === 'post') {
    return updatePost(contentId, { status: 'hidden' } as any)
  } else {
    return updateCommentStatus(contentId, 'hidden')
  }
}

// ── Admin: Flagged Content Queue ─────────────────────────────────

export async function getFlaggedContent() {
  return getFlaggedContentIds()
}

// ── Cron: Auto-Approve Old Pending Posts ─────────────────────────

export async function autoApprovePendingPosts(minutesOld = 30) {
  const posts = await getAutoApprovablePosts(minutesOld)
  if (posts.length === 0) return { approved: 0 }

  let approved = 0
  for (const post of posts) {
    await updatePost(post.id, {
      status: 'approved',
      autoApprovedAt: new Date(),
    } as any)
    approved++
  }

  return { approved }
}

// ── Cron: Upvote Milestone Bonus ─────────────────────────────────

export async function processUpvoteMilestones(threshold = 100) {
  const posts = await getPostsWithUpvoteMilestone(threshold)
  if (posts.length === 0) return { processed: 0 }

  let processed = 0
  for (const post of posts) {
    // Award 50-point milestone bonus
    await awardPoints(
      post.authorId,
      50,
      'community_deal_milestone',
      post.id,
      `Your deal post reached ${threshold}+ upvotes!`
    )

    // Mark as milestone-awarded by setting pointsAwarded >= 50
    await updatePost(post.id, { pointsAwarded: 50 } as any)
    processed++
  }

  return { processed }
}

// ── Cron: Process Expired Deals ──────────────────────────────────

export async function processExpiredDeals() {
  const expired = await getExpiredActiveDeals()
  if (expired.length === 0) return { processed: 0 }

  const ids = expired.map(d => d.id)
  await markDealsExpired(ids)

  // Notify savers about each expired deal
  for (const deal of expired) {
    const savers = await getConsumersWhoSavedDeal(deal.id)
    if (savers.length > 0) {
      emit(PLATFORM_EVENTS.BRAND_DISCOUNT_CREATED, {
        actorId: deal.brandId,
        actorRole: 'brand',
        brandId: deal.brandId,
        dealId: deal.id,
        dealTitle: deal.title,
        expired: true,
      }).catch(() => {})
    }
  }

  return { processed: ids.length }
}

// ── Cron: Auto-Hide Heavily Flagged ──────────────────────────────

export async function autoHideFlaggedContent() {
  const flagged = await getFlaggedContentIds()
  let hidden = 0

  for (const item of flagged) {
    const { content_type, content_id, flag_count } = item as any
    if (flag_count >= 5) {
      await hideContent(content_type, content_id)
      hidden++
    }
  }

  return { hidden }
}
