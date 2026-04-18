/**
 * Community Deals Service
 *
 * Business logic for Reddit-style community deal sharing:
 * - Post lifecycle: create (auto-approve brands), feed, detail
 * - Voting: upvote/downvote with toggle semantics
 * - Comments: threaded, with voting
 * - Saves: bookmark posts
 * - Flagging: report content, auto-hide at threshold
 * - Points: awards on post, comment, upvotes received
 */

import 'server-only'

import {
  createPost as createPostRepo,
  getPostById,
  updatePost,
  getPostsByAuthor,
  searchPosts as searchPostsRepo,
  getTrendingPosts as getTrendingPostsRepo,
  getPostsByBrand as getPostsByBrandRepo,
  getPostVote,
  createPostVote,
  updatePostVote,
  deletePostVote,
  updatePostVoteCounts,
  savePost as savePostRepo,
  unsavePost as unsavePostRepo,
  isPostSaved,
  getSavedPosts as getSavedPostsRepo,
  createComment as createCommentRepo,
  getCommentById,
  getComments as getCommentsRepo,
  updateCommentStatus,
  getCommentVote,
  createCommentVote,
  updateCommentVote,
  deleteCommentVote,
  updateCommentUpvoteCount,
  createFlag as createFlagRepo,
  getFlagCount,
  hasUserFlagged,
  findDuplicatePromoCode,
} from '@/db/repositories/communityDealsRepository'
import { getDealById } from '@/db/repositories/dealsRepository'
import { type NewCommunityDealsPost, type NewCommunityDealsComment } from '@/db/schema'
import { awardPoints, POINT_VALUES } from '@/server/pointsService'
import { emit, PLATFORM_EVENTS } from '@/server/eventBus'

const AUTO_HIDE_FLAG_THRESHOLD = 5

// ── Post Creation ────────────────────────────────────────────────

export async function createCommunityPost(
  authorId: string,
  authorRole: string,
  data: Omit<NewCommunityDealsPost, 'authorId' | 'authorRole' | 'status'>
) {
  // Auto-approve brand posts that reference a verified deal
  let status = 'pending'
  if (authorRole === 'brand') {
    if (data.dealId) {
      const deal = await getDealById(data.dealId)
      if (deal && deal.brandId === authorId && deal.isVerified) {
        status = 'approved'
      }
    }
    // Brand posts without verified deal still go to pending
  }

  // Check for duplicate promo codes
  if (data.promoCode) {
    const isDupe = await findDuplicatePromoCode(data.promoCode)
    if (isDupe) throw new Error('This promo code has already been shared')
  }

  const post = await createPostRepo({
    ...data,
    authorId,
    authorRole,
    status,
    isBrandVerified: authorRole === 'brand' && status === 'approved',
  })

  // Award points for posting
  await awardPoints(
    authorId,
    POINT_VALUES.community_post,
    'community_deal_post',
    post.id,
    'Shared a deal with the community'
  )

  // Emit event
  emit(PLATFORM_EVENTS.CONSUMER_COMMUNITY_POSTED, {
    actorId: authorId,
    actorRole: authorRole as 'brand' | 'consumer',
    postId: post.id,
    postTitle: post.title,
    brandId: data.brandId ?? undefined,
  }).catch(() => {})

  return post
}

// ── Post Feed ────────────────────────────────────────────────────

export async function getCommunityFeed(params: {
  q?: string
  category?: string
  postType?: string
  sort?: 'relevance' | 'newest' | 'top' | 'rising'
  cursor?: string
  limit?: number
}) {
  return searchPostsRepo(params)
}

export async function getTrendingPosts(sinceHours = 24, limit = 10) {
  return getTrendingPostsRepo(sinceHours, limit)
}

// ── Post Detail ──────────────────────────────────────────────────

export async function getPostDetail(postId: string, userId?: string) {
  const post = await getPostById(postId)
  if (!post) return null
  if (post.status !== 'approved' && post.authorId !== userId) return null

  let userVote: string | null = null
  let saved = false

  if (userId) {
    const [vote, isSaved] = await Promise.all([
      getPostVote(postId, userId),
      isPostSaved(postId, userId),
    ])
    userVote = vote?.voteType ?? null
    saved = isSaved
  }

  return { ...post, userVote, isSaved: saved }
}

// ── My Posts ─────────────────────────────────────────────────────

export async function getMyPosts(authorId: string, cursor?: string, limit = 20) {
  return getPostsByAuthor(authorId, cursor, limit)
}

// ── Brand Posts ──────────────────────────────────────────────────

export async function getBrandCommunityPosts(brandId: string, cursor?: string, limit = 20) {
  return getPostsByBrandRepo(brandId, cursor, limit)
}

// ── Voting ───────────────────────────────────────────────────────

export async function voteOnPost(postId: string, userId: string, voteType: 'up' | 'down') {
  const post = await getPostById(postId)
  if (!post || post.status !== 'approved') throw new Error('Post not found')

  const existing = await getPostVote(postId, userId)

  if (existing) {
    if (existing.voteType === voteType) {
      // Toggle off — remove vote
      await deletePostVote(existing.id)
    } else {
      // Switch vote direction
      await updatePostVote(existing.id, voteType)
    }
  } else {
    // New vote
    await createPostVote(postId, userId, voteType)

    // Award points for receiving an upvote (to the post author, not the voter)
    if (voteType === 'up' && post.authorId !== userId) {
      awardPoints(
        post.authorId,
        POINT_VALUES.community_upvote_received,
        'community_deal_upvote',
        postId,
        'Your community deal post received an upvote'
      ).catch(() => {})
    }
  }

  // Recount votes
  await updatePostVoteCounts(postId)
}

// ── Comments ─────────────────────────────────────────────────────

export async function addComment(
  postId: string,
  authorId: string,
  authorRole: string,
  body: string,
  parentCommentId?: string
) {
  const post = await getPostById(postId)
  if (!post || post.status !== 'approved') throw new Error('Post not found')

  // If replying, verify parent comment exists and belongs to same post
  if (parentCommentId) {
    const parent = await getCommentById(parentCommentId)
    if (!parent || parent.postId !== postId) throw new Error('Parent comment not found')
  }

  const comment = await createCommentRepo({
    postId,
    authorId,
    authorRole,
    body,
    parentCommentId: parentCommentId ?? null,
    isBrandVerified: authorRole === 'brand',
  })

  // Award points for commenting
  await awardPoints(
    authorId,
    POINT_VALUES.community_reply,
    'community_deal_comment',
    comment.id,
    'Commented on a community deal'
  )

  return comment
}

export async function getComments(postId: string, cursor?: string, limit = 30) {
  return getCommentsRepo(postId, cursor, limit)
}

// ── Comment Voting ───────────────────────────────────────────────

export async function voteOnComment(commentId: string, userId: string, voteType: 'up' | 'down') {
  const comment = await getCommentById(commentId)
  if (!comment || comment.status !== 'active') throw new Error('Comment not found')

  const existing = await getCommentVote(commentId, userId)

  if (existing) {
    if (existing.voteType === voteType) {
      await deleteCommentVote(existing.id)
    } else {
      await updateCommentVote(existing.id, voteType)
    }
  } else {
    await createCommentVote(commentId, userId, voteType)

    if (voteType === 'up' && comment.authorId !== userId) {
      awardPoints(
        comment.authorId,
        POINT_VALUES.community_upvote_received,
        'community_deal_comment_upvote',
        commentId,
        'Your comment received an upvote'
      ).catch(() => {})
    }
  }

  await updateCommentUpvoteCount(commentId)
}

// ── Post Saves ───────────────────────────────────────────────────

export async function toggleSavePost(postId: string, userId: string) {
  const post = await getPostById(postId)
  if (!post) throw new Error('Post not found')

  const alreadySaved = await isPostSaved(postId, userId)
  if (alreadySaved) {
    await unsavePostRepo(postId, userId)
    return { saved: false }
  } else {
    await savePostRepo(postId, userId)
    return { saved: true }
  }
}

export async function getUserSavedPosts(userId: string, cursor?: string, limit = 20) {
  return getSavedPostsRepo(userId, cursor, limit)
}

// ── Flagging ─────────────────────────────────────────────────────

export async function flagContent(
  contentType: 'post' | 'comment',
  contentId: string,
  userId: string,
  reason: string,
  details?: string
) {
  // Check if user already flagged this content
  const alreadyFlagged = await hasUserFlagged(contentType, contentId, userId)
  if (alreadyFlagged) throw new Error('You have already flagged this content')

  const flag = await createFlagRepo({
    contentType,
    contentId,
    flaggedBy: userId,
    reason,
    details,
  })

  // Auto-hide if flag threshold reached
  const flagCount = await getFlagCount(contentType, contentId)
  if (flagCount >= AUTO_HIDE_FLAG_THRESHOLD) {
    if (contentType === 'post') {
      await updatePost(contentId, { status: 'hidden' } as any)
    } else {
      await updateCommentStatus(contentId, 'hidden')
    }
  }

  return flag
}
