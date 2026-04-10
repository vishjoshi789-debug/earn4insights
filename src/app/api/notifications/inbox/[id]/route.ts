import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import {
  markItemRead,
  markItemUnread,
  deleteInboxItem,
} from '@/db/repositories/notificationInboxRepository'

/**
 * PATCH /api/notifications/inbox/[id]
 *   Body: { isRead: boolean }
 *   Mark a single notification read or unread.
 *
 * DELETE /api/notifications/inbox/[id]
 *   Dismiss (hard-delete) a notification.
 */

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = (session.user as any).id as string

    const { id } = await params
    const body = await request.json()
    const { isRead } = body

    if (typeof isRead !== 'boolean') {
      return NextResponse.json({ error: 'isRead (boolean) is required' }, { status: 400 })
    }

    const success = isRead
      ? await markItemRead(id, userId)
      : await markItemUnread(id, userId)

    if (!success) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, isRead })
  } catch (error) {
    console.error('[PATCH /api/notifications/inbox/[id]]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = (session.user as any).id as string

    const { id } = await params
    const success = await deleteInboxItem(id, userId)

    if (!success) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[DELETE /api/notifications/inbox/[id]]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
