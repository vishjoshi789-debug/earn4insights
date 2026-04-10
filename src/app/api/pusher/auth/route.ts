import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { getPusherServer } from '@/lib/pusher'
import { db } from '@/db'
import { userProfiles } from '@/db/schema'
import { eq } from 'drizzle-orm'

/**
 * POST /api/pusher/auth
 *
 * Authenticates a Pusher channel subscription request.
 * Called automatically by the Pusher client for private-* and presence-* channels.
 *
 * Private channels:  private-user-{userId}     — personal notifications
 * Presence channels: presence-dashboard        — active user tracking
 *
 * Rejects:
 *  - Unauthenticated requests (no NextAuth session)
 *  - Attempts to subscribe to another user's private channel
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id as string
    const role   = (session.user as any).role as string
    const name   = session.user.name ?? session.user.email ?? userId

    // Pusher sends form-encoded body: socket_id + channel_name
    const body = await request.text()
    const params = new URLSearchParams(body)
    const socketId   = params.get('socket_id')
    const channelName = params.get('channel_name')

    if (!socketId || !channelName) {
      return NextResponse.json({ error: 'Missing socket_id or channel_name' }, { status: 400 })
    }

    const pusher = getPusherServer()

    // ── Private channels ────────────────────────────────────────────────
    // Only allow subscribing to your own user channel
    if (channelName.startsWith('private-')) {
      const expectedChannel = `private-user-${userId}`
      if (channelName !== expectedChannel) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      const authResponse = pusher.authorizeChannel(socketId, channelName)
      return NextResponse.json(authResponse)
    }

    // ── Presence channels ────────────────────────────────────────────────
    // Expose safe public data — never include sensitive profile fields
    if (channelName.startsWith('presence-')) {
      const presenceData = {
        user_id:   userId,
        user_info: { name, role },
      }
      const authResponse = pusher.authorizeChannel(socketId, channelName, presenceData)

      // Update last_active_at — fire-and-forget, never block the auth response
      db.update(userProfiles)
        .set({ lastActiveAt: new Date() })
        .where(eq(userProfiles.id, userId))
        .catch(err => console.error('[Pusher auth] Failed to update lastActiveAt:', err))

      return NextResponse.json(authResponse)
    }

    // Public channels don't need auth — client should not call this endpoint for them
    return NextResponse.json({ error: 'Channel does not require auth' }, { status: 400 })

  } catch (error) {
    console.error('[Pusher auth] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
