import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import {
  getInbox,
  getUnreadCount,
  markAllRead,
} from '@/db/repositories/notificationInboxRepository'

/**
 * GET /api/notifications/inbox
 *   Returns paginated notification inbox + unread count.
 *   Query: ?unreadOnly=true &type=feedback_received &before=<ISO> &limit=20
 *
 * POST /api/notifications/inbox
 *   Mark all notifications as read (shortcut — same as /mark-all-read).
 */

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = (session.user as any).id as string

    const { searchParams } = new URL(request.url)
    const unreadOnly = searchParams.get('unreadOnly') === 'true'
    const type       = searchParams.get('type') ?? undefined
    const beforeStr  = searchParams.get('before')
    const limit      = Math.min(Number(searchParams.get('limit') ?? '20'), 50)
    const before     = beforeStr ? new Date(beforeStr) : undefined

    const [items, unreadCount] = await Promise.all([
      getInbox(userId, { unreadOnly, type, before, limit }),
      getUnreadCount(userId),
    ])

    return NextResponse.json({
      items,
      unreadCount,
      hasMore: items.length === limit,
      nextCursor: items.length > 0 ? items[items.length - 1].createdAt.toISOString() : null,
    })
  } catch (error) {
    console.error('[GET /api/notifications/inbox]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = (session.user as any).id as string

    const count = await markAllRead(userId)
    return NextResponse.json({ success: true, markedRead: count })
  } catch (error) {
    console.error('[POST /api/notifications/inbox]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
