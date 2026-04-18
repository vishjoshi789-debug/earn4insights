/**
 * POST /api/community-deals/posts/[id]/save
 *
 * Toggle save/unsave a community post. Auth required.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { toggleSavePost } from '@/server/communityService'

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

    const { id } = await params
    const result = await toggleSavePost(id, userId)
    return NextResponse.json(result)
  } catch (error: any) {
    if (error.message === 'Post not found') {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    console.error('[PostSave POST]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
