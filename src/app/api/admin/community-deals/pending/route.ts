/**
 * GET /api/admin/community-deals/pending
 *
 * List pending community posts for moderation. Admin only.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { getPendingPosts } from '@/server/dealsModerationService'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if ((session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Admin access only' }, { status: 403 })
    }

    const p = req.nextUrl.searchParams
    const result = await getPendingPosts(
      p.get('cursor') ?? undefined,
      Math.min(parseInt(p.get('limit') ?? '20'), 50)
    )
    return NextResponse.json(result)
  } catch (error) {
    console.error('[AdminPendingPosts GET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
