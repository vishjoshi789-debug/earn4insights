import 'server-only'

import { eq } from 'drizzle-orm'
import { db } from '@/db'
import type { DbTx } from '@/db/tx'
import {
  brandAlertRules,
  brandAlerts,
  brandIcps,
  brandRewardConfigs,
  communityDealsPost,
  contributionEvents,
  deals,
  importJobs,
  influencerCampaigns,
  influencerContentPosts,
} from '@/db/schema'

/**
 * Re-key every brand-scoped record attached to a product.
 *
 * ── WHY THIS EXISTS ───────────────────────────────────────────────────────
 * A brand is pointed at by TWO independent keys, and only one of them is the
 * product:
 *
 *   products.owner_id   — ONE column, ONE table
 *   brand_id            — 23 tables
 *
 * Changing `owner_id` moves the product. It does not touch `brand_id` on
 * anything. And every reader scopes by `brand_id` ALONE — `icpRepository:99`,
 * `dealsRepository:41`, `competitiveIntelligenceRepository:74` — so a row left
 * behind is invisible to the new owner AND dangling for the old one, **with no
 * error on either side**. The two keys simply disagree, and nothing notices.
 *
 * Found the hard way on 2026-09-22: the Group C reassignment moved 3 products
 * and left `contribution_events.brand_id` NULL on their contributions. Caught
 * by the founder checking by hand, not by any code.
 *
 * ⚠️⚠️ THIS IS THE ONE LIST. Do not write a second one inline.
 * A merge script written from the audit's own table list still omitted
 * `influencer_content_posts` and `influencer_campaigns` — a list that is
 * re-derived per callsite drifts on its first use. Every ownership change
 * (claim, merge, reassign) calls THIS function.
 *
 * Regenerate the list from the schema, never from memory:
 *   grep -n "brandId: text('brand_id')"  src/db/schema.ts
 *   grep -n "productId: text('product_id')" src/db/schema.ts
 * The dual-key set is the INTERSECTION.
 *
 * ── Why `productId` and not `oldBrandId` ──────────────────────────────────
 * The product is the thing that moved, and every row about it belongs to
 * whoever owns it now. Keying on the old brand would miss rows whose
 * `brand_id` was NULL — which is exactly the claim case (an unclaimed product
 * has no brand at all) and exactly the bug this was written for.
 */

/**
 * Tables carrying BOTH `brand_id` and a product reference.
 *
 * ⚠️ DELIBERATE EXCLUSIONS — do not "complete" this list:
 *
 *   razorpay_orders, payment_redemptions, brand_subscriptions
 *     Brand-scoped with no product dimension. Re-keying `razorpay_orders`
 *     would falsify WHO PAID. Money history stays with the account that
 *     spent the money, permanently.
 *
 *   content_review_reminders, competitor_profiles + the 6 competitive tables
 *     `brand_id` only, no product column — nothing to re-key.
 *
 *   competitor_products
 *     `product_id` only, NO `brand_id`. Brand scoping is one level up via
 *     `competitor_profiles.brand_id`. It is not a dual-key table, and an
 *     earlier draft of this list wrongly counted it as one.
 *
 *   feedback, surveys, survey_responses, extracted_themes, product_watchlist,
 *   social_posts, community_posts, consumer_intents, user_events
 *     Product-scoped only. They follow the product for free.
 */
const DUAL_KEY_REKEYS: ReadonlyArray<{
  readonly table: string
  readonly rekey: (tx: DbTx, productId: string, newBrandId: string) => Promise<number>
}> = [
  {
    table: 'brand_alert_rules',
    rekey: async (tx, p, b) =>
      (await tx.update(brandAlertRules).set({ brandId: b })
        .where(eq(brandAlertRules.productId, p))
        .returning({ id: brandAlertRules.id })).length,
  },
  {
    table: 'brand_alerts',
    rekey: async (tx, p, b) =>
      (await tx.update(brandAlerts).set({ brandId: b })
        .where(eq(brandAlerts.productId, p))
        .returning({ id: brandAlerts.id })).length,
  },
  {
    table: 'brand_icps',
    rekey: async (tx, p, b) =>
      (await tx.update(brandIcps).set({ brandId: b })
        .where(eq(brandIcps.productId, p))
        .returning({ id: brandIcps.id })).length,
  },
  {
    table: 'brand_reward_configs',
    rekey: async (tx, p, b) =>
      (await tx.update(brandRewardConfigs).set({ brandId: b })
        .where(eq(brandRewardConfigs.productId, p))
        .returning({ id: brandRewardConfigs.id })).length,
  },
  {
    table: 'community_deals_posts',
    rekey: async (tx, p, b) =>
      (await tx.update(communityDealsPost).set({ brandId: b })
        .where(eq(communityDealsPost.productId, p))
        .returning({ id: communityDealsPost.id })).length,
  },
  {
    table: 'contribution_events',
    rekey: async (tx, p, b) =>
      (await tx.update(contributionEvents).set({ brandId: b })
        .where(eq(contributionEvents.productId, p))
        .returning({ id: contributionEvents.id })).length,
  },
  {
    table: 'deals',
    rekey: async (tx, p, b) =>
      (await tx.update(deals).set({ brandId: b })
        .where(eq(deals.productId, p))
        .returning({ id: deals.id })).length,
  },
  {
    table: 'influencer_campaigns',
    rekey: async (tx, p, b) =>
      (await tx.update(influencerCampaigns).set({ brandId: b })
        .where(eq(influencerCampaigns.productId, p))
        .returning({ id: influencerCampaigns.id })).length,
  },
  {
    table: 'influencer_content_posts',
    rekey: async (tx, p, b) =>
      (await tx.update(influencerContentPosts).set({ brandId: b })
        .where(eq(influencerContentPosts.productId, p))
        .returning({ id: influencerContentPosts.id })).length,
  },
  {
    // ⚠️ The only one whose product column is NOT `product_id`. A name-driven
    // loop over table names would silently skip it; the closure absorbs the
    // irregularity instead of hiding it.
    table: 'import_jobs',
    rekey: async (tx, p, b) =>
      (await tx.update(importJobs).set({ brandId: b })
        .where(eq(importJobs.defaultProductId, p))
        .returning({ id: importJobs.id })).length,
  },
]

/** Rows moved, per table. Only tables with at least one row are included. */
export type BrandRekeyReport = Record<string, number>

/**
 * Point every brand-keyed record for `productId` at `newBrandId`.
 *
 * Idempotent — re-running sets the same value again and reports the same
 * counts, so a retry after a partial failure is safe.
 *
 * @param existingTx Run inside the caller's transaction instead of opening
 *   one. Pass this whenever the re-key must be atomic with the ownership
 *   change itself — otherwise `owner_id` can commit while the re-key fails,
 *   which is precisely the drift this function exists to prevent. Without it,
 *   the function opens its own transaction so the 10 tables still move
 *   together.
 */
export async function rekeyBrandForProduct(
  productId: string,
  newBrandId: string,
  existingTx?: DbTx,
): Promise<BrandRekeyReport> {
  if (!productId || !newBrandId) {
    throw new Error(
      `rekeyBrandForProduct: productId and newBrandId are both required ` +
      `(got productId=${productId || 'empty'}, newBrandId=${newBrandId || 'empty'})`,
    )
  }

  const run = async (tx: DbTx): Promise<BrandRekeyReport> => {
    const report: BrandRekeyReport = {}
    for (const entry of DUAL_KEY_REKEYS) {
      const moved = await entry.rekey(tx, productId, newBrandId)
      if (moved > 0) report[entry.table] = moved
    }
    return report
  }

  return existingTx ? run(existingTx) : db.transaction(run)
}
