/**
 * Watchlist Service — Phase 1A
 *
 * Lets consumers say "notify me when this product launches / updates / adds a feature".
 * Also handles launch-to-watchlist matching (Phase 1C): when a product goes live,
 * all watchers are queued for notification.
 */

import { db } from '@/db'
import { productWatchlist, products, type Deal } from '@/db/schema'
import { eq, and, desc, count } from 'drizzle-orm'
import { dispatchToUser } from '@/server/realtimeNotificationService'
import { MIN_COHORT_SIZE } from '@/lib/privacy/cohort'
import { WATCHER_INSIGHT_TIER, type WatcherInsight } from '@/lib/privacy/watcherInsight'

// ── Types ──────────────────────────────────────────────────────────

// 'deal' added 2026-09-16 so a consumer can opt into deal alerts WITHOUT
// receiving every other kind — before it existed, only 'any' watchers would
// have received deal notifications, with no way to want just those.
export type WatchType = 'launch' | 'price_drop' | 'feature' | 'update' | 'deal' | 'any'

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

/**
 * Raw active-watcher count for a product. PRIVATE — the only caller is
 * watcherInsightFor, which applies the tier and the cohort floor.
 *
 * ⚠️ This used to be exported with the comment "used for brand dashboard +
 * watchlist_milestone alerts". BOTH WERE FALSE: it had zero callers, the
 * milestone alert was removed in a66114b, and no brand dashboard ever read
 * it. A comment does not compile, so it stays true-looking after the code
 * stops being true. It is un-exported now so the raw, unfloored number cannot
 * reach a brand surface without passing the gate.
 */
async function countActiveWatchers(productId: string): Promise<number> {
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

// ── THE ONE GATE for brand-facing watcher insight ───────────────────
//
// Follows consumerVisibleProducts() exactly: one exported function, every
// brand-facing surface calls it, NO surface reads product_watchlist directly.
// The tier and the floor are two separate knobs owned by lib/privacy — legal
// sets the tier (a commit), the floor is platform policy shared with every
// other aggregate. Changing either is a config change here, not a refactor
// anywhere else.

export interface WatcherInsightViewer {
  userId: string
  /**
   * Owner or admin of the product. ⚠️ Defaults CLOSED — a non-owner is always
   * suppressed. T0 is about a brand's OWN product. Whether a brand may see
   * watcher counts on a competitor's product is a different product question
   * with a different consent shape, not a config flip (founder decision,
   * 2026-09-16).
   */
  isOwner: boolean
}

/**
 * What this viewer may learn about who is watching this product.
 *
 * Never returns 0. Below the floor it returns `{ tier: 'suppressed' }`, the
 * same contract as the ICP and CI repository helpers: zero is a claim, and a
 * false one when the true count is 1–4.
 */
export async function watcherInsightFor(
  productId: string,
  viewer: WatcherInsightViewer,
): Promise<WatcherInsight> {
  if (!viewer.isOwner) return { tier: 'suppressed', reason: 'not_owner' }
  if (WATCHER_INSIGHT_TIER === 'none') return { tier: 'suppressed', reason: 'tier_none' }

  const watchers = await countActiveWatchers(productId)
  if (watchers < MIN_COHORT_SIZE) return { tier: 'suppressed', reason: 'below_floor' }

  switch (WATCHER_INSIGHT_TIER) {
    case 'count':
      return { tier: 'count', watchers }

    // Designed, NOT BUILT. Fail loudly at the gate rather than silently
    // downstream: a config change to an unbuilt tier must be impossible to
    // miss. See lib/privacy/watcherInsight for what each tier requires —
    // 'demographic' and 'identified' need a consent prompt that does not
    // exist yet, and that prompt is the part that is not optional.
    case 'trend':
    case 'demographic':
    case 'identified':
      throw new Error(
        `WATCHER_INSIGHT_TIER='${WATCHER_INSIGHT_TIER}' is designed but not implemented. ` +
        `See lib/privacy/watcherInsight.ts before building it.`,
      )

    // 'none' is handled above. This default exists so that adding a tier to
    // the union without adding a case here is a COMPILE error, not a runtime
    // fall-through that returns undefined to a brand surface.
    default: {
      const unhandled: never = WATCHER_INSIGHT_TIER
      throw new Error(`Unhandled WATCHER_INSIGHT_TIER: ${String(unhandled)}`)
    }
  }
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

/**
 * A brand deal was published on a watched product.
 *
 * Second emitter on the same machine — the whole point of the refactor. Takes
 * the already-loaded deal rather than a dealId, because publishDeal has just
 * read it and a second read of the same row would be waste.
 *
 * ⚠️ EXPLICIT GUARD on a null productId, not a silent skip inside
 * notifyWatchers (which takes a string and cannot be handed null). A
 * brand-wide deal with no product has no watchers by definition — that is a
 * normal case, named here, not an error. Same shape as the v16 null-user_id
 * skips.
 *
 * ⚠️ OVERLAP WITH BRAND_DISCOUNT_CREATED, recorded not filtered. publishDeal
 * also emits that event, whose handler dispatches to consumers matching the
 * brand's ICPs — an AUDIENCE, consent-gated, no bypass. This wrapper reaches
 * people who WATCHED the product — their own act, §7 bypass. Different
 * populations, both legitimate, and they can overlap: a watcher who also
 * ICP-matches would get two bells. Today that is impossible — icp_match_scores
 * has 0 rows — so no filter is built against a condition that cannot occur.
 * When bulk ICP scoring ships, the ICP handler must EXCLUDE product watchers;
 * they have already been told, more specifically. That filter belongs with
 * that work.
 */
export async function notifyWatchersOnDeal(
  deal: Pick<Deal, 'id' | 'title' | 'productId'>,
): Promise<NotifyWatchersResult> {
  if (!deal.productId) return { total: 0, notified: 0, skipped: 0 }

  return notifyWatchers(deal.productId, {
    watchTypes: ['deal', 'any'],
    eventType: 'consumer.watchlist.deal_posted',
    buildMessage: (product) => ({
      title: `New deal on ${product.name}`,
      body: `${deal.title} — a deal was just posted on a product you're watching.`,
      ctaUrl: '/dashboard/deals',
      emailSubject: `🏷️ New deal on "${product.name}"`,
      emailBody: `A product you're watching has a new deal: ${deal.title}. See it in Deals & Offers.`,
    }),
  })
}
