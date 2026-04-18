/**
 * POST /api/community-deals/posts/[id]/vote
 *
 * Upvote or downvote a post. Toggle semantics.
 * Body: { voteType: 'up' | 'down' }
 * Auth required.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { voteOnPost } from '@/server/communityService'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    const { id } = await params
    await voteOnPost(id, userId, body.voteType)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    if (error.message === 'Post not found') {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    console.error('[PostVote POST]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
