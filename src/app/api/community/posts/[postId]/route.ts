import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { db } from '@/db'
import { communityPosts, communityReplies, communityReactions, users, products } from '@/db/schema'
import { eq, sql } from 'drizzle-orm'

// GET /api/community/posts/[postId] — get a single post with replies
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { postId } = await params

    // Fetch post with author info
    const postResult = await db
      .select({
        id: communityPosts.id,
        authorId: communityPosts.authorId,
        productId: communityPosts.productId,
        title: communityPosts.title,
        body: communityPosts.body,
        postType: communityPosts.postType,
        isPinned: communityPosts.isPinned,
        isLocked: communityPosts.isLocked,
        upvotes: communityPosts.upvotes,
        downvotes: communityPosts.downvotes,
        replyCount: communityPosts.replyCount,
        viewCount: communityPosts.viewCount,
        tags: communityPosts.tags,
        pollOptions: communityPosts.pollOptions,
        createdAt: communityPosts.createdAt,
        updatedAt: communityPosts.updatedAt,
        authorName: users.name,
        authorRole: users.role,
        productName: products.name,
      })
      .from(communityPosts)
      .leftJoin(users, eq(communityPosts.authorId, users.id))
      .leftJoin(products, eq(communityPosts.productId, products.id))
      .where(eq(communityPosts.id, postId))
      .limit(1)

    if (postResult.length === 0) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    // Increment view count
    await db
      .update(communityPosts)
      .set({ viewCount: sql`${communityPosts.viewCount} + 1` })
      .where(eq(communityPosts.id, postId))

    // Fetch replies with author info
    const repliesResult = await db
      .select({
        id: communityReplies.id,
        postId: communityReplies.postId,
        authorId: communityReplies.authorId,
        parentReplyId: communityReplies.parentReplyId,
        body: communityReplies.body,
        upvotes: communityReplies.upvotes,
        downvotes: communityReplies.downvotes,
        createdAt: communityReplies.createdAt,
        authorName: users.name,
        authorRole: users.role,
      })
      .from(communityReplies)
      .leftJoin(users, eq(communityReplies.authorId, users.id))
      .where(eq(communityReplies.postId, postId))
      .orderBy(communityReplies.createdAt)

    // Get current user's reactions on this post
    const userReactions = await db
      .select({
        postId: communityReactions.postId,
        replyId: communityReactions.replyId,
        reactionType: communityReactions.reactionType,
      })
      .from(communityReactions)
      .where(eq(communityReactions.userId, session.user.id))

    return NextResponse.json({
      post: postResult[0],
      replies: repliesResult,
      userReactions,
    })
  } catch (error) {
    console.error('[Community Post GET] Error:', error)
    return NextResponse.json({ error: 'Failed to fetch post' }, { status: 500 })
  }
}

// DELETE /api/community/posts/[postId] — delete own post
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { postId } = await params

    // Check ownership
    const post = await db
      .select({ authorId: communityPosts.authorId })
      .from(communityPosts)
      .where(eq(communityPosts.id, postId))
      .limit(1)

    if (post.length === 0) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    if (post[0].authorId !== session.user.id) {
      return NextResponse.json({ error: 'You can only delete your own posts' }, { status: 403 })
    }

    // Delete related data first
    await db.delete(communityReplies).where(eq(communityReplies.postId, postId))
    await db.delete(communityReactions).where(eq(communityReactions.postId, postId))
    await db.delete(communityPosts).where(eq(communityPosts.id, postId))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Community Post DELETE] Error:', error)
    return NextResponse.json({ error: 'Failed to delete post' }, { status: 500 })
  }
}
