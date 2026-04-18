import 'server-only'

import { db, sql } from '@/db'
import {
  communityDealsPost,
  communityDealsPostVotes,
  communityDealsPostSaves,
  communityDealsComments,
  communityDealsCommentVotes,
  communityDealsFlags,
  type NewCommunityDealsPost,
  type NewCommunityDealsComment,
} from '@/db/schema'
import { eq, and, desc, asc, lt, gt, gte, lte, inArray, or, not } from 'drizzle-orm'

// ═══════════════════════════════════════════════════════════════════
// POSTS CRUD
// ═══════════════════════════════════════════════════════════════════

export async function createPost(data: NewCommunityDealsPost) {
  const [post] = await db.insert(communityDealsPost).values(data).returning()
  return post
}

export async function getPostById(id: string) {
  const [post] = await db.select().from(communityDealsPost).where(eq(communityDealsPost.id, id)).limit(1)
  return post ?? null
}

export async function updatePost(id: string, data: Partial<NewCommunityDealsPost>) {
  const [post] = await db.update(communityDealsPost).set(data).where(eq(communityDealsPost.id, id)).returning()
  return post ?? null
}

export async function getPostsByAuthor(authorId: string, cursor?: string, limit = 20) {
  const conditions: any[] = [eq(communityDealsPost.authorId, authorId)]
  if (cursor) conditions.push(lt(communityDealsPost.createdAt, new Date(cursor)))

  const rows = await db
    .select()
    .from(communityDealsPost)
    .where(and(...conditions))
    .orderBy(desc(communityDealsPost.createdAt))
    .limit(limit + 1)

  const hasMore = rows.length > limit
  return {
    posts: rows.slice(0, limit),
    nextCursor: hasMore ? rows[limit - 1].createdAt.toISOString() : null,
  }
}

// ═══════════════════════════════════════════════════════════════════
// SEARCH + FEED
// ═══════════════════════════════════════════════════════════════════

export async function searchPosts(params: {
  q?: string
  category?: string
  postType?: string
  sort?: 'relevance' | 'newest' | 'top' | 'rising'
  cursor?: string
  limit?: number
}) {
  const lim = params.limit ?? 20
  const conditions: any[] = [eq(communityDealsPost.status, 'approved')]

  if (params.category) conditions.push(eq(communityDealsPost.category, params.category))
  if (params.postType) conditions.push(eq(communityDealsPost.postType, params.postType))
  if (params.cursor) conditions.push(lt(communityDealsPost.createdAt, new Date(params.cursor)))

  if (params.q) {
    conditions.push(sql`search_vector @@ plainto_tsquery('english', ${params.q})`)
  }

  let orderBy
  switch (params.sort) {
    case 'relevance':
      orderBy = params.q
        ? sql`ts_rank(search_vector, plainto_tsquery('english', ${params.q})) DESC`
        : desc(communityDealsPost.upvoteCount)
      break
    case 'top':
      orderBy = desc(communityDealsPost.upvoteCount)
      break
    case 'rising': {
      // Rising = high upvotes relative to age. Score posts < 48h old by upvotes.
      const cutoff = new Date(Date.now() - 48 * 3600_000)
      conditions.push(gte(communityDealsPost.createdAt, cutoff))
      orderBy = desc(communityDealsPost.upvoteCount)
      break
    }
    default:
      orderBy = desc(communityDealsPost.createdAt)
  }

  const rows = await db
    .select()
    .from(communityDealsPost)
    .where(and(...conditions))
    .orderBy(orderBy)
    .limit(lim + 1)

  const hasMore = rows.length > lim
  return {
    posts: rows.slice(0, lim),
    nextCursor: hasMore ? rows[lim - 1].createdAt.toISOString() : null,
  }
}

export async function getTrendingPosts(sinceHours = 24, limit = 10) {
  const since = new Date(Date.now() - sinceHours * 3600_000)
  return db
    .select()
    .from(communityDealsPost)
    .where(and(eq(communityDealsPost.status, 'approved'), gte(communityDealsPost.createdAt, since)))
    .orderBy(desc(communityDealsPost.upvoteCount))
    .limit(limit)
}

export async function getPostsByBrand(brandId: string, cursor?: string, limit = 20) {
  const conditions: any[] = [
    eq(communityDealsPost.status, 'approved'),
    or(
      eq(communityDealsPost.brandId, brandId),
      eq(communityDealsPost.authorId, brandId)
    ),
  ]
  if (cursor) conditions.push(lt(communityDealsPost.createdAt, new Date(cursor)))

  const rows = await db
    .select()
    .from(communityDealsPost)
    .where(and(...conditions))
    .orderBy(desc(communityDealsPost.createdAt))
    .limit(limit + 1)

  const hasMore = rows.length > limit
  return {
    posts: rows.slice(0, limit),
    nextCursor: hasMore ? rows[limit - 1].createdAt.toISOString() : null,
  }
}

// ═══════════════════════════════════════════════════════════════════
// VOTES
// ═══════════════════════════════════════════════════════════════════

export async function getPostVote(postId: string, userId: string) {
  const [vote] = await db
    .select()
    .from(communityDealsPostVotes)
    .where(and(eq(communityDealsPostVotes.postId, postId), eq(communityDealsPostVotes.userId, userId)))
    .limit(1)
  return vote ?? null
}

export async function createPostVote(postId: string, userId: string, voteType: string) {
  try {
    const [vote] = await db.insert(communityDealsPostVotes).values({ postId, userId, voteType }).returning()
    return vote
  } catch (err: any) {
    if (err?.message?.includes('23505') || err?.code === '23505') return null
    throw err
  }
}

export async function updatePostVote(id: string, voteType: string) {
  const [vote] = await db.update(communityDealsPostVotes).set({ voteType }).where(eq(communityDealsPostVotes.id, id)).returning()
  return vote ?? null
}

export async function deletePostVote(id: string) {
  await db.delete(communityDealsPostVotes).where(eq(communityDealsPostVotes.id, id))
}

export async function updatePostVoteCounts(postId: string) {
  const [upCount] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(communityDealsPostVotes)
    .where(and(eq(communityDealsPostVotes.postId, postId), eq(communityDealsPostVotes.voteType, 'up')))
  const [downCount] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(communityDealsPostVotes)
    .where(and(eq(communityDealsPostVotes.postId, postId), eq(communityDealsPostVotes.voteType, 'down')))

  await db.update(communityDealsPost).set({
    upvoteCount: upCount?.count ?? 0,
    downvoteCount: downCount?.count ?? 0,
  }).where(eq(communityDealsPost.id, postId))
}

// ═══════════════════════════════════════════════════════════════════
// POST SAVES
// ═══════════════════════════════════════════════════════════════════

export async function savePost(postId: string, userId: string) {
  try {
    await db.insert(communityDealsPostSaves).values({ postId, userId })
    await db.execute(sql`UPDATE community_deals_posts SET save_count = save_count + 1 WHERE id = ${postId}`)
    return true
  } catch (err: any) {
    if (err?.message?.includes('23505') || err?.code === '23505') return false
    throw err
  }
}

export async function unsavePost(postId: string, userId: string) {
  const [deleted] = await db
    .delete(communityDealsPostSaves)
    .where(and(eq(communityDealsPostSaves.postId, postId), eq(communityDealsPostSaves.userId, userId)))
    .returning()
  if (deleted) {
    await db.execute(sql`UPDATE community_deals_posts SET save_count = GREATEST(save_count - 1, 0) WHERE id = ${postId}`)
  }
  return !!deleted
}

export async function isPostSaved(postId: string, userId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: communityDealsPostSaves.id })
    .from(communityDealsPostSaves)
    .where(and(eq(communityDealsPostSaves.postId, postId), eq(communityDealsPostSaves.userId, userId)))
    .limit(1)
  return !!row
}

export async function getSavedPosts(userId: string, cursor?: string, limit = 20) {
  const conditions: any[] = [eq(communityDealsPostSaves.userId, userId)]
  if (cursor) conditions.push(lt(communityDealsPostSaves.savedAt, new Date(cursor)))

  const rows = await db
    .select({ postId: communityDealsPostSaves.postId, savedAt: communityDealsPostSaves.savedAt })
    .from(communityDealsPostSaves)
    .where(and(...conditions))
    .orderBy(desc(communityDealsPostSaves.savedAt))
    .limit(limit + 1)

  const hasMore = rows.length > limit
  const postIds = rows.slice(0, limit).map(r => r.postId)

  if (postIds.length === 0) return { posts: [], nextCursor: null }

  const postRows = await db.select().from(communityDealsPost).where(inArray(communityDealsPost.id, postIds))
  const postMap = Object.fromEntries(postRows.map(p => [p.id, p]))
  const ordered = postIds.map(id => postMap[id]).filter(Boolean)

  return {
    posts: ordered,
    nextCursor: hasMore ? rows[limit - 1].savedAt.toISOString() : null,
  }
}

// ═══════════════════════════════════════════════════════════════════
// COMMENTS
// ═══════════════════════════════════════════════════════════════════

export async function createComment(data: NewCommunityDealsComment) {
  const [comment] = await db.insert(communityDealsComments).values(data).returning()
  // Increment comment count on post
  await db.execute(sql`UPDATE community_deals_posts SET comment_count = comment_count + 1 WHERE id = ${data.postId}`)
  return comment
}

export async function getCommentById(id: string) {
  const [comment] = await db.select().from(communityDealsComments).where(eq(communityDealsComments.id, id)).limit(1)
  return comment ?? null
}

export async function getComments(postId: string, cursor?: string, limit = 30) {
  const conditions: any[] = [
    eq(communityDealsComments.postId, postId),
    eq(communityDealsComments.status, 'active'),
  ]
  if (cursor) conditions.push(gt(communityDealsComments.createdAt, new Date(cursor)))

  const rows = await db
    .select()
    .from(communityDealsComments)
    .where(and(...conditions))
    .orderBy(asc(communityDealsComments.createdAt))
    .limit(limit + 1)

  const hasMore = rows.length > limit
  return {
    comments: rows.slice(0, limit),
    nextCursor: hasMore ? rows[limit - 1].createdAt.toISOString() : null,
  }
}

export async function updateCommentStatus(id: string, status: string) {
  const [comment] = await db
    .update(communityDealsComments)
    .set({ status })
    .where(eq(communityDealsComments.id, id))
    .returning()
  return comment ?? null
}

// ═══════════════════════════════════════════════════════════════════
// COMMENT VOTES
// ═══════════════════════════════════════════════════════════════════

export async function getCommentVote(commentId: string, userId: string) {
  const [vote] = await db
    .select()
    .from(communityDealsCommentVotes)
    .where(and(eq(communityDealsCommentVotes.commentId, commentId), eq(communityDealsCommentVotes.userId, userId)))
    .limit(1)
  return vote ?? null
}

export async function createCommentVote(commentId: string, userId: string, voteType: string) {
  try {
    const [vote] = await db.insert(communityDealsCommentVotes).values({ commentId, userId, voteType }).returning()
    return vote
  } catch (err: any) {
    if (err?.message?.includes('23505') || err?.code === '23505') return null
    throw err
  }
}

export async function updateCommentVote(id: string, voteType: string) {
  const [vote] = await db.update(communityDealsCommentVotes).set({ voteType }).where(eq(communityDealsCommentVotes.id, id)).returning()
  return vote ?? null
}

export async function deleteCommentVote(id: string) {
  await db.delete(communityDealsCommentVotes).where(eq(communityDealsCommentVotes.id, id))
}

export async function updateCommentUpvoteCount(commentId: string) {
  const [result] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(communityDealsCommentVotes)
    .where(and(eq(communityDealsCommentVotes.commentId, commentId), eq(communityDealsCommentVotes.voteType, 'up')))
  await db.update(communityDealsComments).set({ upvoteCount: result?.count ?? 0 }).where(eq(communityDealsComments.id, commentId))
}

// ═══════════════════════════════════════════════════════════════════
// FLAGS
// ═══════════════════════════════════════════════════════════════════

export async function createFlag(data: {
  contentType: string
  contentId: string
  flaggedBy: string
  reason: string
  details?: string
}) {
  const [flag] = await db.insert(communityDealsFlags).values(data).returning()
  return flag
}

export async function getFlagCount(contentType: string, contentId: string) {
  const [result] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(communityDealsFlags)
    .where(and(
      eq(communityDealsFlags.contentType, contentType),
      eq(communityDealsFlags.contentId, contentId),
      eq(communityDealsFlags.status, 'pending')
    ))
  return result?.count ?? 0
}

export async function hasUserFlagged(contentType: string, contentId: string, userId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: communityDealsFlags.id })
    .from(communityDealsFlags)
    .where(and(
      eq(communityDealsFlags.contentType, contentType),
      eq(communityDealsFlags.contentId, contentId),
      eq(communityDealsFlags.flaggedBy, userId)
    ))
    .limit(1)
  return !!row
}

// ═══════════════════════════════════════════════════════════════════
// MODERATION QUEUE
// ═══════════════════════════════════════════════════════════════════

export async function getPendingPosts(cursor?: string, limit = 20) {
  const conditions: any[] = [
    or(
      eq(communityDealsPost.status, 'pending'),
      eq(communityDealsPost.status, 'needs_edit')
    ),
  ]
  if (cursor) conditions.push(lt(communityDealsPost.createdAt, new Date(cursor)))

  const rows = await db
    .select()
    .from(communityDealsPost)
    .where(and(...conditions))
    .orderBy(asc(communityDealsPost.createdAt)) // oldest first
    .limit(limit + 1)

  const hasMore = rows.length > limit
  return {
    posts: rows.slice(0, limit),
    nextCursor: hasMore ? rows[limit - 1].createdAt.toISOString() : null,
  }
}

export async function getAutoApprovablePosts(minutesOld = 30) {
  const cutoff = new Date(Date.now() - minutesOld * 60_000)
  return db
    .select()
    .from(communityDealsPost)
    .where(
      and(
        eq(communityDealsPost.status, 'pending'),
        lt(communityDealsPost.createdAt, cutoff)
      )
    )
    .limit(100)
}

export async function getFlaggedContentIds() {
  // Posts that have 3+ pending flags
  const result = await db.execute(sql`
    SELECT content_type, content_id, COUNT(*)::int AS flag_count
    FROM community_deals_flags
    WHERE status = 'pending'
    GROUP BY content_type, content_id
    HAVING COUNT(*) >= 3
  `)
  return (result as any[]) ?? []
}

export async function getPostsWithUpvoteMilestone(threshold = 100) {
  return db
    .select()
    .from(communityDealsPost)
    .where(
      and(
        eq(communityDealsPost.status, 'approved'),
        gte(communityDealsPost.upvoteCount, threshold),
        // Only posts that haven't received the milestone bonus yet (points_awarded < 50 means no milestone bonus)
        lt(communityDealsPost.pointsAwarded, 50)
      )
    )
    .limit(50)
}

export async function findDuplicatePromoCode(promoCode: string, excludePostId?: string) {
  const conditions: any[] = [
    eq(communityDealsPost.promoCode, promoCode),
    eq(communityDealsPost.status, 'approved'),
  ]
  if (excludePostId) conditions.push(not(eq(communityDealsPost.id, excludePostId)))

  const [existing] = await db
    .select({ id: communityDealsPost.id })
    .from(communityDealsPost)
    .where(and(...conditions))
    .limit(1)

  return !!existing
}
