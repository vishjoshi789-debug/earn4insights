/**
 * POST /api/community-deals/posts/[id]/comments/[commentId]/vote
 *
 * Upvote or downvote a comment. Toggle semantics.
 * Body: { voteType: 'up' | 'down' }
 * Auth required.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { voteOnComment } from '@/server/communityService'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = (session.user as any).id

    const body = await req.json().catch(() => null)
    if (!body?.voteType || !['up', 'down'].includes(body.voteType)) {
      return NextResponse.json({ error: 'voteType must be "up" or "down"' }, { status: 400 })
    }

    const { commentId } = await params
    await voteOnComment(commentId, userId, body.voteType)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    if (error.message === 'Comment not found') {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    console.error('[CommentVote POST]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
