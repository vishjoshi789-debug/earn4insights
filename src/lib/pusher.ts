import 'server-only'
import PusherServer from 'pusher'

// ── Singleton ──────────────────────────────────────────────────────────────
// Pusher server client. Used only in API routes and server-side services.
// Never import this from client components.

let _pusher: PusherServer | null = null

function getPusherServer(): PusherServer {
  if (_pusher) return _pusher

  const appId   = process.env.PUSHER_APP_ID
  const key     = process.env.PUSHER_KEY
  const secret  = process.env.PUSHER_SECRET
  const cluster = process.env.PUSHER_CLUSTER ?? 'ap2'

  if (!appId || !key || !secret) {
    throw new Error(
      '[Pusher] Missing required environment variables: PUSHER_APP_ID, PUSHER_KEY, PUSHER_SECRET. ' +
      'Add these to your .env.local and Vercel project settings.'
    )
  }

  _pusher = new PusherServer({ appId, key, secret, cluster, useTLS: true })
  return _pusher
}

// ── Channel name helpers ───────────────────────────────────────────────────

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

// ── Event names (keep in sync with pusher-client.ts) ─────────────────────

export const PUSHER_EVENTS = {
  // Notification events (fired on private-user-{userId})
  NEW_NOTIFICATION:       'new-notification',
  UNREAD_COUNT_UPDATE:    'unread-count-update',

  // Activity feed events (fired on private-user-{userId})
  ACTIVITY_FEED_UPDATE:   'activity-feed-update',

  // Product page events (fired on public-product-{productId})
  NEW_FEEDBACK:           'new-feedback',
  VIEWER_COUNT_UPDATE:    'viewer-count-update',
} as const

export type PusherEventName = typeof PUSHER_EVENTS[keyof typeof PUSHER_EVENTS]

// ── Trigger helper ────────────────────────────────────────────────────────

/**
 * Trigger a Pusher event. Best-effort — logs errors but never throws,
 * so a Pusher failure never breaks the main request flow.
 */
export async function triggerPusherEvent(
  channel: string,
  event: PusherEventName,
  data: Record<string, unknown>
): Promise<void> {
  try {
    const pusher = getPusherServer()
    await pusher.trigger(channel, event, data)
  } catch (error) {
    // Pusher is an enhancement layer — never let it break the main flow
    console.error(`[Pusher] Failed to trigger "${event}" on "${channel}":`, error)
  }
}

/**
 * Trigger the same event on multiple channels at once (Pusher supports up to 100).
 */
export async function triggerPusherEventBatch(
  channels: string[],
  event: PusherEventName,
  data: Record<string, unknown>
): Promise<void> {
  if (channels.length === 0) return
  try {
    const pusher = getPusherServer()
    // Pusher batch supports up to 100 channels; chunk if needed
    const BATCH_SIZE = 100
    for (let i = 0; i < channels.length; i += BATCH_SIZE) {
      await pusher.trigger(channels.slice(i, i + BATCH_SIZE), event, data)
    }
  } catch (error) {
    console.error(`[Pusher] Failed to trigger batch "${event}":`, error)
  }
}

export { getPusherServer }
