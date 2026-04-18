/**
 * POST /api/community-deals/posts/[id]/flag
 *
 * Flag a post for moderation review.
 * Body: { reason: string, details?: string }
 * Auth required.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { flagContent } from '@/server/communityService'

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
    if (!body?.reason || typeof body.reason !== 'string') {
      return NextResponse.json({ error: 'reason is required' }, { status: 400 })
    }

    const { id } = await params
    const flag = await flagContent('post', id, userId, body.reason, body.details)
    return NextResponse.json({ flag }, { status: 201 })
  } catch (error: any) {
    if (error.message === 'You have already flagged this content') {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    console.error('[PostFlag POST]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
