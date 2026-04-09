import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { getFeed } from '@/db/repositories/activityFeedRepository'

/**
 * GET /api/activity-feed
 *   Returns a user's activity feed, newest first.
 *   Query: ?limit=10 &before=<ISO cursor> &eventType=<type>
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = (session.user as any).id as string

    const { searchParams } = new URL(request.url)
    const limit      = Math.min(Number(searchParams.get('limit') ?? '10'), 50)
    const beforeStr  = searchParams.get('before')
    const eventType  = searchParams.get('eventType') ?? undefined
    const before     = beforeStr ? new Date(beforeStr) : undefined

    const items = await getFeed(userId, { limit, before, eventType })

    return NextResponse.json({
      items,
      hasMore:    items.length === limit,
      nextCursor: items.length > 0 ? items[items.length - 1].createdAt.toISOString() : null,
    })
  } catch (error) {
    console.error('[GET /api/activity-feed]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
