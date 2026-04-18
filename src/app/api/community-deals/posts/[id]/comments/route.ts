/**
 * GET  /api/community-deals/posts/[id]/comments — List comments on a post
 * POST /api/community-deals/posts/[id]/comments — Add a comment (threaded)
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { addComment, getComments } from '@/server/communityService'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const p = req.nextUrl.searchParams
    const result = await getComments(
      id,
      p.get('cursor') ?? undefined,
      Math.min(parseInt(p.get('limit') ?? '30'), 50)
    )
    return NextResponse.json(result)
  } catch (error) {
    console.error('[PostComments GET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

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
    const role = (session.user as any).role ?? 'consumer'

    const body = await req.json().catch(() => null)
    if (!body?.body || typeof body.body !== 'string') {
      return NextResponse.json({ error: 'body is required' }, { status: 400 })
    }

    const { id } = await params
    const comment = await addComment(id, userId, role, body.body, body.parentCommentId)
    return NextResponse.json({ comment }, { status: 201 })
  } catch (error: any) {
    if (error.message === 'Post not found' || error.message === 'Parent comment not found') {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    console.error('[PostComments POST]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
