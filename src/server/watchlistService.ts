/**
 * Watchlist Service — Phase 1A
 *
 * Lets consumers say "notify me when this product launches / updates / adds a feature".
 * Also handles launch-to-watchlist matching (Phase 1C): when a product goes live,
 * all watchers are queued for notification.
 */

import { db } from '@/db'
import { productWatchlist, products, users } from '@/db/schema'
import { eq, and, desc, count } from 'drizzle-orm'
import { queueNotification } from '@/server/notificationService'

// ── Types ──────────────────────────────────────────────────────────

export type WatchType = 'launch' | 'price_drop' | 'feature' | 'update' | 'any'

export interface AddToWatchlistInput {
  userId: string
  productId: string
  watchType: WatchType
  desiredFeature?: string
  notifyChannels?: string[]
}

// ── Core CRUD ──────────────────────────────────────────────────────

/** Add a product to the consumer's watchlist */
export async function addToWatchlist(input: AddToWatchlistInput) {
  const { userId, productId, watchType, desiredFeature, notifyChannels } = input

  // Prevent duplicates (same user + product + watchType)
  const existing = await db
    .select()
    .from(productWatchlist)
    .where(
      and(
        eq(productWatchlist.userId, userId),
        eq(productWatchlist.productId, productId),
        eq(productWatchlist.watchType, watchType),
        eq(productWatchlist.active, true),
      ),
    )
    .limit(1)

  if (existing.length > 0) {
    return { alreadyExists: true, entry: existing[0] }
  }

  const [entry] = await db
    .insert(productWatchlist)
    .values({
      userId,
      productId,
      watchType,
      desiredFeature: desiredFeature || null,
      notifyChannels: notifyChannels || ['email'],
    })
    .returning()

  return { alreadyExists: false, entry }
}

/** Get a consumer's full watchlist */
export async function getWatchlist(userId: string) {
  const entries = await db
    .select({
      id: productWatchlist.id,
      productId: productWatchlist.productId,
      productName: products.name,
      watchType: productWatchlist.watchType,
      desiredFeature: productWatchlist.desiredFeature,
      notifyChannels: productWatchlist.notifyChannels,
      active: productWatchlist.active,
      notifiedAt: productWatchlist.notifiedAt,
      createdAt: productWatchlist.createdAt,
    })
    .from(productWatchlist)
    .leftJoin(products, eq(productWatchlist.productId, products.id))
    .where(
      and(
        eq(productWatchlist.userId, userId),
        eq(productWatchlist.active, true),
      ),
    )
    .orderBy(desc(productWatchlist.createdAt))

  return entries
}

/** Remove (deactivate) a watchlist entry */
export async function removeFromWatchlist(id: string, userId: string) {
  const [updated] = await db
    .update(productWatchlist)
    .set({ active: false })
    .where(
      and(
        eq(productWatchlist.id, id),
        eq(productWatchlist.userId, userId),
      ),
    )
    .returning()

  return updated || null
}

/** Check if a consumer is watching a specific product */
export async function isWatching(userId: string, productId: string) {
  const entries = await db
    .select({ id: productWatchlist.id, watchType: productWatchlist.watchType })
    .from(productWatchlist)
    .where(
      and(
        eq(productWatchlist.userId, userId),
        eq(productWatchlist.productId, productId),
        eq(productWatchlist.active, true),
      ),
    )

  return entries.length > 0 ? entries : null
}

/** Count watchers for a product (used for brand dashboard + watchlist_milestone alerts) */
export async function getWatcherCount(productId: string) {
  const [result] = await db
    .select({ total: count() })
    .from(productWatchlist)
    .where(
      and(
        eq(productWatchlist.productId, productId),
        eq(productWatchlist.active, true),
      ),
    )

  return result?.total ?? 0
}

// ── Phase 1C: Launch → Watchlist Matching ──────────────────────────

/**
 * When a product is launched / activated, find all active watchers
 * and queue notifications for each one.
 */
export async function notifyWatchersOnLaunch(productId: string) {
  // Fetch product name
  const [product] = await db
    .select({ name: products.name })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1)

  if (!product) return { notified: 0 }

  // Find all active watchers with type 'launch' or 'any'
  const watchers = await db
    .select({
      id: productWatchlist.id,
      userId: productWatchlist.userId,
      watchType: productWatchlist.watchType,
      notifyChannels: productWatchlist.notifyChannels,
    })
    .from(productWatchlist)
    .where(
      and(
        eq(productWatchlist.productId, productId),
        eq(productWatchlist.active, true),
      ),
    )

  // Filter to launch-related watch types
  const launchWatchers = watchers.filter(
    (w) => w.watchType === 'launch' || w.watchType === 'any',
  )

  let notified = 0
  for (const watcher of launchWatchers) {
    const channels = (watcher.notifyChannels as string[]) || ['email']

    for (const channel of channels) {
      try {
        await queueNotification({
          userId: watcher.userId,
          channel: channel as 'email' | 'whatsapp' | 'sms',
          type: 'watchlist_match',
          subject: `🚀 "${product.name}" just launched!`,
          body: `Great news! A product you've been watching — "${product.name}" — is now live. Check it out and share your feedback.`,
          metadata: { productId, watchType: watcher.watchType },
          priority: 2, // high priority — user explicitly asked for this
        })
        notified++
      } catch (err) {
        console.error(`[Watchlist] Failed to notify ${watcher.userId}:`, err)
      }
    }

    // Mark as notified
    await db
      .update(productWatchlist)
      .set({ notifiedAt: new Date() })
      .where(eq(productWatchlist.id, watcher.id))
  }

  return { notified, totalWatchers: launchWatchers.length }
}
