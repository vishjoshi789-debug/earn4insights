import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { db } from '@/db'
import { communityPollVotes, communityPosts } from '@/db/schema'
import { eq, and } from 'drizzle-orm'

// POST /api/community/poll/vote — vote on a poll
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { postId, optionId } = body

    if (!postId || !optionId) {
      return NextResponse.json({ error: 'postId and optionId are required' }, { status: 400 })
    }

    // Verify this is a poll post
    const post = await db
      .select({ id: communityPosts.id, postType: communityPosts.postType, pollOptions: communityPosts.pollOptions })
      .from(communityPosts)
      .where(eq(communityPosts.id, postId))
      .limit(1)

    if (post.length === 0) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    if (post[0].postType !== 'poll' || !post[0].pollOptions) {
      return NextResponse.json({ error: 'This post is not a poll' }, { status: 400 })
    }

    const options = post[0].pollOptions as { id: string; text: string; votes: number }[]
    const validOption = options.find(o => o.id === optionId)
    if (!validOption) {
      return NextResponse.json({ error: 'Invalid option' }, { status: 400 })
    }

    // Check if user already voted
    const existingVote = await db
      .select()
      .from(communityPollVotes)
      .where(and(eq(communityPollVotes.postId, postId), eq(communityPollVotes.userId, session.user.id)))
      .limit(1)

    if (existingVote.length > 0) {
      return NextResponse.json({ error: 'You have already voted on this poll' }, { status: 409 })
    }

    // Record vote
    await db.insert(communityPollVotes).values({
      postId,
      userId: session.user.id,
      optionId,
    })

    // Update poll options vote count
    const updatedOptions = options.map(o =>
      o.id === optionId ? { ...o, votes: o.votes + 1 } : o
    )

    await db
      .update(communityPosts)
      .set({ pollOptions: updatedOptions })
      .where(eq(communityPosts.id, postId))

    return NextResponse.json({ success: true, pollOptions: updatedOptions }, { status: 201 })
  } catch (error) {
    console.error('[Community Poll Vote POST] Error:', error)
    return NextResponse.json({ error: 'Failed to vote' }, { status: 500 })
  }
}
