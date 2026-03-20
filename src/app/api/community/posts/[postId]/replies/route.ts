import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { db } from '@/db'
import { communityReplies, communityPosts } from '@/db/schema'
import { eq, sql } from 'drizzle-orm'
import { awardPoints, POINT_VALUES } from '@/server/pointsService'

// POST /api/community/posts/[postId]/replies — add a reply
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { postId } = await params
    const body = await req.json()
    const { content, parentReplyId } = body

    if (!content?.trim()) {
      return NextResponse.json({ error: 'Reply content is required' }, { status: 400 })
    }

    if (content.trim().length > 5000) {
      return NextResponse.json({ error: 'Reply must be under 5,000 characters' }, { status: 400 })
    }

    // Check post exists and is not locked
    const post = await db
      .select({ id: communityPosts.id, isLocked: communityPosts.isLocked })
      .from(communityPosts)
      .where(eq(communityPosts.id, postId))
      .limit(1)

    if (post.length === 0) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    if (post[0].isLocked) {
      return NextResponse.json({ error: 'This thread is locked' }, { status: 403 })
    }

    // If parentReplyId is provided, verify it exists and belongs to this post
    if (parentReplyId) {
      const parentReply = await db
        .select({ id: communityReplies.id })
        .from(communityReplies)
        .where(eq(communityReplies.id, parentReplyId))
        .limit(1)

      if (parentReply.length === 0) {
        return NextResponse.json({ error: 'Parent reply not found' }, { status: 404 })
      }
    }

    const [newReply] = await db
      .insert(communityReplies)
      .values({
        postId,
        authorId: session.user.id,
        parentReplyId: parentReplyId || null,
        body: content.trim(),
      })
      .returning()

    // Increment reply count on the post
    await db
      .update(communityPosts)
      .set({ replyCount: sql`${communityPosts.replyCount} + 1` })
      .where(eq(communityPosts.id, postId))

    // Award points for replying
    await awardPoints(
      session.user.id,
      POINT_VALUES.community_reply,
      'community_reply',
      newReply.id,
      'Replied to a community post',
    )

    return NextResponse.json({ reply: newReply }, { status: 201 })
  } catch (error) {
    console.error('[Community Replies POST] Error:', error)
    return NextResponse.json({ error: 'Failed to add reply' }, { status: 500 })
  }
}
