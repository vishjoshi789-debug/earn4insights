import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { db } from '@/db'
import { communityReactions, communityPosts, communityReplies } from '@/db/schema'
import { eq, and, sql } from 'drizzle-orm'
import { awardPoints, POINT_VALUES } from '@/server/pointsService'
import { recordContribution } from '@/server/contributionPipeline'

// POST /api/community/react — upvote/downvote a post or reply
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { postId, replyId, reactionType } = body

    if (!postId && !replyId) {
      return NextResponse.json({ error: 'postId or replyId is required' }, { status: 400 })
    }

    if (!['upvote', 'downvote'].includes(reactionType)) {
      return NextResponse.json({ error: 'Invalid reaction type' }, { status: 400 })
    }

    const userId = session.user.id

    // Check for existing reaction
    const conditions = [eq(communityReactions.userId, userId)]
    if (postId) conditions.push(eq(communityReactions.postId, postId))
    if (replyId) conditions.push(eq(communityReactions.replyId, replyId))

    const existing = await db
      .select()
      .from(communityReactions)
      .where(and(...conditions))
      .limit(1)

    if (existing.length > 0) {
      const oldReaction = existing[0]

      if (oldReaction.reactionType === reactionType) {
        // Same reaction — remove it (toggle off)
        await db.delete(communityReactions).where(eq(communityReactions.id, oldReaction.id))

        // Update counters
        if (postId) {
          const field = reactionType === 'upvote' ? communityPosts.upvotes : communityPosts.downvotes
          await db.update(communityPosts).set({ [reactionType === 'upvote' ? 'upvotes' : 'downvotes']: sql`${field} - 1` }).where(eq(communityPosts.id, postId))
        }
        if (replyId) {
          const field = reactionType === 'upvote' ? communityReplies.upvotes : communityReplies.downvotes
          await db.update(communityReplies).set({ [reactionType === 'upvote' ? 'upvotes' : 'downvotes']: sql`${field} - 1` }).where(eq(communityReplies.id, replyId))
        }

        return NextResponse.json({ action: 'removed', reactionType })
      } else {
        // Different reaction — switch
        await db.update(communityReactions).set({ reactionType }).where(eq(communityReactions.id, oldReaction.id))

        // Swap counters
        if (postId) {
          if (reactionType === 'upvote') {
            await db.update(communityPosts).set({
              upvotes: sql`${communityPosts.upvotes} + 1`,
              downvotes: sql`${communityPosts.downvotes} - 1`,
            }).where(eq(communityPosts.id, postId))
          } else {
            await db.update(communityPosts).set({
              upvotes: sql`${communityPosts.upvotes} - 1`,
              downvotes: sql`${communityPosts.downvotes} + 1`,
            }).where(eq(communityPosts.id, postId))
          }
        }
        if (replyId) {
          if (reactionType === 'upvote') {
            await db.update(communityReplies).set({
              upvotes: sql`${communityReplies.upvotes} + 1`,
              downvotes: sql`${communityReplies.downvotes} - 1`,
            }).where(eq(communityReplies.id, replyId))
          } else {
            await db.update(communityReplies).set({
              upvotes: sql`${communityReplies.upvotes} - 1`,
              downvotes: sql`${communityReplies.downvotes} + 1`,
            }).where(eq(communityReplies.id, replyId))
          }
        }

        return NextResponse.json({ action: 'switched', reactionType })
      }
    }

    // New reaction
    await db.insert(communityReactions).values({
      userId,
      postId: postId || null,
      replyId: replyId || null,
      reactionType,
    })

    // Increment counter
    if (postId) {
      const field = reactionType === 'upvote' ? 'upvotes' : 'downvotes'
      const col = reactionType === 'upvote' ? communityPosts.upvotes : communityPosts.downvotes
      await db.update(communityPosts).set({ [field]: sql`${col} + 1` }).where(eq(communityPosts.id, postId))
    }
    if (replyId) {
      const field = reactionType === 'upvote' ? 'upvotes' : 'downvotes'
      const col = reactionType === 'upvote' ? communityReplies.upvotes : communityReplies.downvotes
      await db.update(communityReplies).set({ [field]: sql`${col} + 1` }).where(eq(communityReplies.id, replyId))
    }

    // Award points to the content author for receiving an upvote
    if (reactionType === 'upvote') {
      let authorId: string | null = null
      if (postId) {
        const p = await db.select({ authorId: communityPosts.authorId }).from(communityPosts).where(eq(communityPosts.id, postId)).limit(1)
        authorId = p[0]?.authorId ?? null
      } else if (replyId) {
        const r = await db.select({ authorId: communityReplies.authorId }).from(communityReplies).where(eq(communityReplies.id, replyId)).limit(1)
        authorId = r[0]?.authorId ?? null
      }
      if (authorId && authorId !== userId) {
        await awardPoints(authorId, POINT_VALUES.community_upvote_received, 'community_upvote_received', postId || replyId || undefined, 'Received an upvote')

        // AI contribution scoring for the upvoted author (non-blocking)
        recordContribution({
          userId: authorId,
          contributionType: 'community_upvote_received',
          sourceId: postId || replyId || undefined,
          metadata: { upvoteFromUserId: userId, postId, replyId },
        }).catch(err => console.error('[ContributionPipeline] upvote error:', err))
      }
    }

    return NextResponse.json({ action: 'added', reactionType }, { status: 201 })
  } catch (error) {
    console.error('[Community React POST] Error:', error)
    return NextResponse.json({ error: 'Failed to react' }, { status: 500 })
  }
}
