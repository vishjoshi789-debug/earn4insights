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
import { dispatchToUser } from '@/server/realtimeNotificationService'

// ── Types ──────────────────────────────────────────────────────────

export type WatchType = 'launch' | 'price_drop' | 'feature' | 'update' | 'any'

export interface AddToWatchlistInput {
  userId: string
  productId: string
  watchType: WatchType
  desiredFeature?: string
  notifyChannels?: string[]
}

/**
 * Thrown by addToWatchlist when the productId resolves to nothing.
 *
 * ⚠️ Before this, addToWatchlist never touched `products` at all — it checked
 * only for an existing watchlist row and inserted. A consumer (or anyone with
 * a session) could POST any string as productId and create an orphan row
 * pointing at a product that does not exist. Typed so the route can answer
 * 404 rather than 500.
 */
export class ProductNotFoundError extends Error {
  constructor(productId: string) {
    super(`Product not found: ${productId}`)
    this.name = 'ProductNotFoundError'
  }
}

// ── Core CRUD ──────────────────────────────────────────────────────

/** Add a product to the consumer's watchlist */
export async function addToWatchlist(input: AddToWatchlistInput) {
  const { userId, productId, watchType, desiredFeature, notifyChannels } = input

  // The product must exist. Cheapest possible probe — id only.
  const [product] = await db
    .select({ id: products.id })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1)
  if (!product) throw new ProductNotFoundError(productId)

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

// ── Watcher notification — ONE machine, many emitters ──────────────
//
// ⚠️ THIS IS DELIBERATELY AN EMITTER WITH NO REACHABLE RECIPIENTS TODAY.
//
// Consumers can only watch products that are already live (getAllProducts
// filters launchStatus = 'live'), and launch is the only trigger — so at the
// moment this runs, the watcher set is empty by construction. That is the
// fourth ignition-key instance found in the 2026-09 session. It is refactored
// now, ahead of the "Coming Soon" reveal that will let consumers watch a
// scheduled product before it launches, so that the loop is proven ONCE with
// real recipients and price_drop / feature_update can then plug in as extra
// wrappers below — not as a second system.
//
// If the reveal never ships, this is the fifth machine-without-fuel for real.

/** What a specific emitter (launch, price drop, …) tells the generic machine. */
export interface NotifyWatchersOptions {
  /** Which `watchType`s qualify for this event. 'any' should usually be included. */
  watchTypes: readonly WatchType[]
  /**
   * The preference / inbox event type. MUST be in NOTIFIABLE_EVENT_TYPES so a
   * consumer can turn it off from /dashboard/settings — an event type the
   * preferences UI cannot see is a notification the consumer cannot refuse.
   */
  eventType: string
  /** Copy is the emitter's, not the machine's. */
  buildMessage: (product: { id: string; name: string }) => {
    title: string
    body: string
    ctaUrl?: string
    emailSubject?: string
    emailBody?: string
  }
}

export interface NotifyWatchersResult {
  /** Watchers whose watchType qualified. */
  total: number
  /** Delivered to at least one channel (inbox or email queue). */
  notified: number
  /** Qualified but delivered nowhere — preferences off, or every channel failed. */
  skipped: number
}

/**
 * Fan an event out to everyone watching a product, honouring their
 * notification preferences and the consent rules, and record who was told.
 *
 * ⚠️ Routes through dispatchToUser, NOT queueNotification. The previous
 * implementation queued email directly, which meant:
 *   - the per-event notification preferences shipped in v17 were BYPASSED —
 *     a consumer who turned email off still got watchlist email;
 *   - there was NO in-app bell, only email drained by a DAILY cron.
 * dispatchToUser gives preferences, inbox + Pusher (instant), and email, in
 * one call, and returns exactly what happened per channel.
 *
 * ⚖️ bypassPersonalizationConsent: TRUE, deliberately. dispatchToUser drops
 * consumers without 'personalization' consent — 8 of 9 today — which is right
 * for launches pushed to an AUDIENCE and wrong here. The test from the
 * resolution loop (consumer.feedback.addressed): is the recipient derived from
 * their own prior act, or selected from an audience? A watcher asked to be
 * told about THIS product. That is DPDP §7 service communication, not
 * personalization. Without the flag the loop would look broken while it was
 * being consent-filtered.
 *
 * `notifiedAt` is set ONLY on actual delivery (inbox created or email queued).
 * It was previously set on every attempt, even when every channel failed — a
 * "notified" timestamp on someone never notified is false data, and this
 * column is the durable "was this person told?" record, the same role
 * resolution_notified_at plays.
 */
export async function notifyWatchers(
  productId: string,
  opts: NotifyWatchersOptions,
): Promise<NotifyWatchersResult> {
  const [product] = await db
    .select({ id: products.id, name: products.name })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1)

  if (!product) return { total: 0, notified: 0, skipped: 0 }

  const watchers = await db
    .select({
      id: productWatchlist.id,
      userId: productWatchlist.userId,
      watchType: productWatchlist.watchType,
    })
    .from(productWatchlist)
    .where(
      and(
        eq(productWatchlist.productId, productId),
        eq(productWatchlist.active, true),
      ),
    )

  const qualifying = watchers.filter((w) =>
    (opts.watchTypes as readonly string[]).includes(w.watchType),
  )

  const message = opts.buildMessage(product)
  let notified = 0

  for (const watcher of qualifying) {
    try {
      const result = await dispatchToUser(
        { userId: watcher.userId, role: 'consumer' },
        {
          eventType: opts.eventType,
          type: opts.eventType,
          title: message.title,
          body: message.body,
          ctaUrl: message.ctaUrl,
          emailSubject: message.emailSubject,
          emailBody: message.emailBody,
          entityType: 'product',
          entityId: product.id,
          metadata: { productId: product.id, watchType: watcher.watchType },
          bypassPersonalizationConsent: true,
        },
      )

      const delivered = result.inboxCreated || result.emailQueued
      if (delivered) {
        notified++
        await db
          .update(productWatchlist)
          .set({ notifiedAt: new Date() })
          .where(eq(productWatchlist.id, watcher.id))
      }
    } catch (err) {
      // One watcher's failure must not stop the fan-out to the rest.
      console.error(`[Watchlist] Failed to notify ${watcher.userId}:`, err)
    }
  }

  return { total: qualifying.length, notified, skipped: qualifying.length - notified }
}

// ── Emitters ───────────────────────────────────────────────────────
//
// Each emitter is a thin wrapper: which watch types, which event type, what
// copy. Adding price_drop or feature_update means adding a wrapper here and
// nothing else — the lookup, preference handling, consent rule, fan-out and
// notifiedAt bookkeeping are all in notifyWatchers.

/**
 * A watched product has gone live.
 *
 * ⚠️ Called ONLY from the publish-scheduled-launches cron. It used to also be
 * called at product creation, which can never have a watcher — the product
 * did not exist a second earlier — and that call was removed so the code no
 * longer implies creation notifies anyone.
 */
export async function notifyWatchersOnLaunch(productId: string): Promise<NotifyWatchersResult> {
  return notifyWatchers(productId, {
    watchTypes: ['launch', 'any'],
    eventType: 'consumer.watchlist.launched',
    buildMessage: (product) => ({
      title: `${product.name} is now live`,
      body: `A product you're watching has launched. Take a look and share your feedback.`,
      ctaUrl: `/dashboard/products/${product.id}`,
      emailSubject: `🚀 "${product.name}" just launched`,
      emailBody: `A product you've been watching — "${product.name}" — is now live. Check it out and share your feedback.`,
    }),
  })
}
