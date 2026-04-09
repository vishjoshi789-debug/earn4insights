'use client'

import { useEffect, useRef, useCallback } from 'react'
import type { Channel, PresenceChannel } from 'pusher-js'
import { getPusherClient, disconnectPusherClient } from '@/lib/pusher-client'

// ── Types ──────────────────────────────────────────────────────────────────

export type PusherChannelType = 'private' | 'presence' | 'public'

export interface UsePusherChannelOptions {
  /** Channel name, e.g. "private-user-abc123" */
  channelName: string
  /** Map of event name → handler */
  events: Record<string, (data: unknown) => void>
  /** Whether to actually subscribe (set false to defer) */
  enabled?: boolean
}

// ── Base hook ──────────────────────────────────────────────────────────────

/**
 * usePusher — subscribe to a Pusher channel and bind event handlers.
 *
 * Handles:
 *  - Lazy Pusher client initialization (only when enabled=true)
 *  - Channel subscription + event binding
 *  - Cleanup on unmount or when channelName/events changes
 *  - Auto-reconnect is handled by the Pusher SDK internally
 *
 * Usage:
 *   usePusher({
 *     channelName: `private-user-${userId}`,
 *     events: { 'new-notification': handleNotification },
 *     enabled: !!userId,
 *   })
 */
export function usePusher({ channelName, events, enabled = true }: UsePusherChannelOptions) {
  const channelRef = useRef<Channel | PresenceChannel | null>(null)
  // Keep a stable ref to events so we don't re-subscribe on every render
  const eventsRef = useRef(events)
  eventsRef.current = events

  useEffect(() => {
    if (!enabled || !channelName) return

    let mounted = true

    try {
      const pusher = getPusherClient()
      const channel = pusher.subscribe(channelName)
      channelRef.current = channel

      // Bind all event handlers
      Object.entries(eventsRef.current).forEach(([event, handler]) => {
        channel.bind(event, handler)
      })

      // Log subscription errors in dev
      channel.bind('pusher:subscription_error', (status: unknown) => {
        if (process.env.NODE_ENV === 'development') {
          console.error(`[Pusher] Subscription error on "${channelName}":`, status)
        }
      })
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.error('[usePusher] Failed to subscribe:', err)
      }
    }

    return () => {
      mounted = false
      if (channelRef.current) {
        // Unbind all handlers before unsubscribing
        Object.keys(eventsRef.current).forEach(event => {
          channelRef.current?.unbind(event)
        })
        try {
          getPusherClient().unsubscribe(channelName)
        } catch {
          // Client may already be disconnected
        }
        channelRef.current = null
      }
    }
  }, [channelName, enabled])
}

/**
 * usePresenceChannel — subscribe to a presence channel and track members.
 * Returns member count and whether a specific userId is online.
 */
export function usePresenceChannel(channelName: string, enabled = true) {
  const channelRef = useRef<PresenceChannel | null>(null)

  const getMemberCount = useCallback((): number => {
    const ch = channelRef.current as any
    return ch?.members?.count ?? 0
  }, [])

  const isMemberOnline = useCallback((userId: string): boolean => {
    const ch = channelRef.current as any
    return !!ch?.members?.get(userId)
  }, [])

  useEffect(() => {
    if (!enabled || !channelName) return

    try {
      const pusher = getPusherClient()
      const channel = pusher.subscribe(channelName) as PresenceChannel
      channelRef.current = channel
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.error('[usePresenceChannel] Failed to subscribe:', err)
      }
    }

    return () => {
      try {
        getPusherClient().unsubscribe(channelName)
      } catch {
        // ignore
      }
      channelRef.current = null
    }
  }, [channelName, enabled])

  return { getMemberCount, isMemberOnline, channelRef }
}
