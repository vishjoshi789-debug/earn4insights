'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { usePusher } from '@/hooks/usePusher'
import { userChannel, PUSHER_EVENTS } from '@/lib/pusher-client'

// ── Types ──────────────────────────────────────────────────────────────────

export interface InboxNotification {
  id:        string | null
  title:     string
  body:      string
  ctaUrl:    string | null
  type:      string
  eventType: string
  createdAt: string
}

// ── Hook ───────────────────────────────────────────────────────────────────

/**
 * useRealtimeNotifications
 *
 * Subscribes to the user's private Pusher channel and keeps the
 * unread count + latest notification in sync in real-time.
 *
 * Also fetches initial unread count from the API on mount so the
 * bell shows the correct badge before any Pusher event arrives.
 *
 * Usage:
 *   const { unreadCount, latestNotification, clearLatest } = useRealtimeNotifications()
 */
export function useRealtimeNotifications() {
  const { data: session } = useSession()
  const userId = (session?.user as any)?.id as string | undefined

  const [unreadCount, setUnreadCount]           = useState(0)
  const [latestNotification, setLatestNotification] = useState<InboxNotification | null>(null)
  const initialFetchDone = useRef(false)

  // ── Fetch initial unread count from API ────────────────────────────────
  useEffect(() => {
    if (!userId || initialFetchDone.current) return
    initialFetchDone.current = true

    fetch('/api/notifications/inbox?limit=1')
      .then(r => r.json())
      .then(data => {
        if (typeof data.unreadCount === 'number') {
          setUnreadCount(data.unreadCount)
        }
      })
      .catch(() => {
        // Non-critical — Pusher will sync the count when events arrive
      })
  }, [userId])

  // ── Pusher event handlers ─────────────────────────────────────────────
  const handleNewNotification = useCallback((data: unknown) => {
    const n = data as InboxNotification
    setLatestNotification(n)
  }, [])

  const handleUnreadCountUpdate = useCallback((data: unknown) => {
    const { count } = data as { count: number }
    if (typeof count === 'number') {
      setUnreadCount(count)
    }
  }, [])

  // ── Subscribe to private-user-{userId} ────────────────────────────────
  usePusher({
    channelName: userId ? userChannel(userId) : '',
    events: {
      [PUSHER_EVENTS.NEW_NOTIFICATION]:    handleNewNotification,
      [PUSHER_EVENTS.UNREAD_COUNT_UPDATE]: handleUnreadCountUpdate,
    },
    enabled: !!userId,
  })

  const clearLatest = useCallback(() => setLatestNotification(null), [])

  /**
   * Optimistically decrement unread count when user reads a notification.
   * The server will confirm the real count on next Pusher event.
   */
  const decrementUnread = useCallback(() => {
    setUnreadCount(prev => Math.max(0, prev - 1))
  }, [])

  /**
   * Reset count to zero (called after mark-all-read).
   */
  const clearUnread = useCallback(() => setUnreadCount(0), [])

  return {
    unreadCount,
    latestNotification,
    clearLatest,
    decrementUnread,
    clearUnread,
  }
}
