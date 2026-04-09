import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { markAllRead } from '@/db/repositories/notificationInboxRepository'

/**
 * POST /api/notifications/mark-all-read
 *   Marks every unread notification as read for the authenticated user.
 *   Returns count of items updated.
 *   Used by the "Mark all read" button in NotificationBell dropdown.
 */
export async function POST(_request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = (session.user as any).id as string

    const count = await markAllRead(userId)
    return NextResponse.json({ success: true, markedRead: count })
  } catch (error) {
    console.error('[POST /api/notifications/mark-all-read]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
