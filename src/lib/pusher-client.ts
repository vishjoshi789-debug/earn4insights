'use client'

import PusherClient from 'pusher-js'

// ── Singleton ──────────────────────────────────────────────────────────────
// Browser-side Pusher client. Lazy-initialized on first call.
// Import only from client components ('use client') or hooks.

let _pusherClient: PusherClient | null = null

export function getPusherClient(): PusherClient {
  if (_pusherClient) return _pusherClient

  const key     = process.env.NEXT_PUBLIC_PUSHER_KEY
  const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER ?? 'ap2'

  if (!key) {
    throw new Error(
      '[Pusher] Missing NEXT_PUBLIC_PUSHER_KEY. ' +
      'Add it to your .env.local and Vercel project settings.'
    )
  }

  _pusherClient = new PusherClient(key, {
    cluster,
    // Modern Pusher JS v8+ auth pattern
    channelAuthorization: {
      endpoint: '/api/pusher/auth',
      transport: 'ajax',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    },
  })

  // Log connection state in development only
  if (process.env.NODE_ENV === 'development') {
    _pusherClient.connection.bind('state_change', ({ current }: { current: string }) => {
      console.debug(`[Pusher] Connection state: ${current}`)
    })
    _pusherClient.connection.bind('error', (err: unknown) => {
      console.error('[Pusher] Connection error:', err)
    })
  }

  return _pusherClient
}

/**
 * Disconnect and destroy the singleton (call on sign-out).
 */
export function disconnectPusherClient(): void {
  if (_pusherClient) {
    _pusherClient.disconnect()
    _pusherClient = null
  }
}

// ── Channel name helpers (duplicated here to avoid importing server-only pusher.ts) ──

/** Private channel for a user's personal notifications */
export function userChannel(userId: string): string {
  return `private-user-${userId}`
}

/** Presence channel for tracking active dashboard users */
export const PRESENCE_DASHBOARD = 'presence-dashboard'

/** Public channel for a product page (live activity) */
export function productChannel(productId: string): string {
  return `public-product-${productId}`
}

// ── Event names ───────────────────────────────────────────────────────────

export const PUSHER_EVENTS = {
  NEW_NOTIFICATION:     'new-notification',
  UNREAD_COUNT_UPDATE:  'unread-count-update',
  ACTIVITY_FEED_UPDATE: 'activity-feed-update',
  NEW_FEEDBACK:         'new-feedback',
  VIEWER_COUNT_UPDATE:  'viewer-count-update',
} as const
