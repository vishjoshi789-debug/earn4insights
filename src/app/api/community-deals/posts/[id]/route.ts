/**
 * GET /api/community-deals/posts/[id]
 *
 * Get post detail with user vote/save state.
 * Optional auth — logged-in users get their vote and save status.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { getPostDetail } from '@/server/communityService'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await auth()
    const userId = session?.user?.email ? (session.user as any).id : undefined

    const post = await getPostDetail(id, userId)
    if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 })

    return NextResponse.json({ post })
  } catch (error) {
    console.error('[CommunityPost GET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
