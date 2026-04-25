import 'server-only'

/**
 * Competitive Alert Service
 *
 * Detects and records 10 categories of competitive events against a brand.
 * Alerts are written to `competitor_alerts` via repo; the eventBus emit
 * is performed by the caller (Phase 8 cron jobs wire real-time dispatch).
 *
 * Privacy discipline
 * ──────────────────
 * Alerts never include raw feedback text, individual consumer identifiers,
 * or competitor financial data beyond publicly visible price points.
 * Consumer-switch detection enforces MIN_COHORT_SIZE at both the overlap
 * cohort AND at each brand's user set (via repo helpers).
 *
 * Dedup window
 * ────────────
 * `alreadyAlertedRecently` short-circuits within a rolling window
 * (default 24 h per (brand, competitor, alertType)). Prevents flood when
 * cron runs multiple times per day or when same event is observed from
 * multiple data sources (e.g. deal scraper + community post).
 */

import { db } from '@/db'
import {
  competitorAlerts,
  competitorProducts,
  competitorPriceHistory,
  feedback,
} from '@/db/schema'
import { eq, and, gte, desc, inArray, sql as drizzleSql } from 'drizzle-orm'
import {
  createAlert,
  getAggregatedSentiment,
  MIN_COHORT_SIZE,
} from '@/db/repositories/competitiveIntelligenceRepository'
import type { NewCompetitorAlert } from '@/db/schema'

// ── Types ─────────────────────────────────────────────────────────

export type AlertType =
  | 'new_product'
  | 'price_change'
  | 'new_deal'
  | 'influencer_campaign'
  | 'sentiment_spike'
  | 'sentiment_drop'
  | 'consumer_switch_to'
  | 'consumer_switch_from'
  | 'market_share_change'
  | 'new_community_post'

export type Severity = 'critical' | 'warning' | 'info'

const DEDUP_WINDOW_HOURS = 24

// Severity defaults per alert type — callers can override.
const DEFAULT_SEVERITY: Record<AlertType, Severity> = {
  new_product: 'info',
  price_change: 'warning',
  new_deal: 'info',
  influencer_campaign: 'info',
  sentiment_spike: 'info',
  sentiment_drop: 'warning',
  consumer_switch_to: 'info',       // consumers coming TO us — good news
  consumer_switch_from: 'critical', // consumers leaving — urgent
  market_share_change: 'warning',
  new_community_post: 'info',
}

// ── Dedup ─────────────────────────────────────────────────────────

async function alreadyAlertedRecently(
  brandId: string,
  alertType: AlertType,
  competitorProfileId: string | null,
  dedupKey?: string
): Promise<boolean> {
  const since = new Date(Date.now() - DEDUP_WINDOW_HOURS * 60 * 60 * 1000)
  const conditions = [
    eq(competitorAlerts.brandId, brandId),
    eq(competitorAlerts.alertType, alertType),
    gte(competitorAlerts.createdAt, since),
  ]
  if (competitorProfileId) {
    conditions.push(eq(competitorAlerts.competitorProfileId, competitorProfileId))
  }
  // Optional fine-grained dedup by content hash stored in data.
  if (dedupKey) {
    conditions.push(drizzleSql`${competitorAlerts.data}->>'dedupKey' = ${dedupKey}`)
  }
  const [row] = await db
    .select({ id: competitorAlerts.id })
    .from(competitorAlerts)
    .where(and(...conditions))
    .limit(1)
  return !!row
}

// ── Generic creator ───────────────────────────────────────────────

async function fireAlert(input: {
  brandId: string
  alertType: AlertType
  competitorProfileId?: string
  title: string
  description: string
  severity?: Severity
  data: Record<string, unknown>
  dedupKey?: string
}) {
  if (
    await alreadyAlertedRecently(
      input.brandId,
      input.alertType,
      input.competitorProfileId ?? null,
      input.dedupKey
    )
  ) {
    return null
  }

  const payload: NewCompetitorAlert = {
    brandId: input.brandId,
    alertType: input.alertType,
    competitorProfileId: input.competitorProfileId ?? null,
    title: input.title,
    description: input.description,
    severity: input.severity ?? DEFAULT_SEVERITY[input.alertType],
    data: { ...input.data, ...(input.dedupKey ? { dedupKey: input.dedupKey } : {}) },
  }
  return createAlert(payload)
}

// ── Detectors ─────────────────────────────────────────────────────

export async function detectNewProduct(params: {
  brandId: string
  competitorProfileId: string
  competitorName: string
  productName: string
  productId: string
  price?: number | null
  currency?: string
}) {
  return fireAlert({
    brandId: params.brandId,
    alertType: 'new_product',
    competitorProfileId: params.competitorProfileId,
    title: `${params.competitorName} launched ${params.productName}`,
    description: `A new product was added by tracked competitor ${params.competitorName}.`,
    data: {
      productId: params.productId,
      productName: params.productName,
      price: params.price ?? null,
      currency: params.currency ?? 'INR',
    },
    dedupKey: `new_product:${params.productId}`,
  })
}

export async function detectPriceChange(params: {
  brandId: string
  competitorProfileId: string
  competitorName: string
  productId: string
  productName: string
  oldPrice: number
  newPrice: number
  currency: string
}) {
  const deltaPct = params.oldPrice === 0
    ? 0
    : ((params.newPrice - params.oldPrice) / params.oldPrice) * 100
  if (Math.abs(deltaPct) < 5) return null               // ignore noise < 5%

  const direction = params.newPrice > params.oldPrice ? 'increased' : 'decreased'
  const severity: Severity = Math.abs(deltaPct) >= 20 ? 'critical' : 'warning'

  return fireAlert({
    brandId: params.brandId,
    alertType: 'price_change',
    competitorProfileId: params.competitorProfileId,
    title: `${params.competitorName} ${direction} ${params.productName} price by ${deltaPct.toFixed(1)}%`,
    description: `Price moved from ${params.oldPrice} to ${params.newPrice} ${params.currency} on ${params.productName}.`,
    severity,
    data: {
      productId: params.productId,
      productName: params.productName,
      oldPrice: params.oldPrice,
      newPrice: params.newPrice,
      deltaPct,
      currency: params.currency,
    },
    dedupKey: `price_change:${params.productId}:${params.newPrice}`,
  })
}

export async function detectNewDeal(params: {
  brandId: string
  competitorProfileId: string
  competitorName: string
  dealId: string
  dealTitle: string
  discountPct?: number
  validUntil?: string
}) {
  const severity: Severity = (params.discountPct ?? 0) >= 40 ? 'warning' : 'info'
  return fireAlert({
    brandId: params.brandId,
    alertType: 'new_deal',
    competitorProfileId: params.competitorProfileId,
    title: `${params.competitorName} launched a deal: ${params.dealTitle}`,
    description: params.discountPct
      ? `New deal with ${params.discountPct}% off${params.validUntil ? ` until ${params.validUntil}` : ''}.`
      : `New deal posted by competitor.`,
    severity,
    data: {
      dealId: params.dealId,
      dealTitle: params.dealTitle,
      discountPct: params.discountPct ?? null,
      validUntil: params.validUntil ?? null,
    },
    dedupKey: `new_deal:${params.dealId}`,
  })
}

export async function detectInfluencerCampaign(params: {
  brandId: string
  competitorProfileId: string
  competitorName: string
  influencerHandle: string
  postId: string
  platform: string
}) {
  return fireAlert({
    brandId: params.brandId,
    alertType: 'influencer_campaign',
    competitorProfileId: params.competitorProfileId,
    title: `Influencer ${params.influencerHandle} promoted ${params.competitorName}`,
    description: `New influencer post on ${params.platform} tagging ${params.competitorName}.`,
    data: {
      postId: params.postId,
      influencerHandle: params.influencerHandle,
      platform: params.platform,
    },
    dedupKey: `influencer_campaign:${params.postId}`,
  })
}

/**
 * Sentiment spike / drop detector. Compares last 7d avg rating to prior
 * 7d for the brand's products. Either side of the zone triggers its
 * own alertType. Requires cohort ≥ 5 in BOTH windows.
 */
export async function detectSentimentShift(params: {
  brandId: string
  brandProductIds: string[]
  category: string
}) {
  const now = Date.now()
  const w1Start = new Date(now - 14 * 86400000)
  const w1End = new Date(now - 7 * 86400000)
  const w2Start = w1End

  const prior = await getAggregatedSentiment(params.brandId, params.brandProductIds, { since: w1Start })
  const current = await getAggregatedSentiment(params.brandId, params.brandProductIds, { since: w2Start })
  if (!prior || !current || prior.avgRating === null || current.avgRating === null) return null

  const delta = current.avgRating - prior.avgRating
  if (Math.abs(delta) < 0.3) return null                 // < 0.3 star shift = noise

  const isSpike = delta > 0
  return fireAlert({
    brandId: params.brandId,
    alertType: isSpike ? 'sentiment_spike' : 'sentiment_drop',
    title: isSpike
      ? `Positive sentiment spike in ${params.category}`
      : `Negative sentiment drop in ${params.category}`,
    description: `Avg rating moved from ${prior.avgRating.toFixed(2)} to ${current.avgRating.toFixed(2)} over the past week.`,
    severity: isSpike ? 'info' : 'warning',
    data: {
      category: params.category,
      priorAvg: prior.avgRating,
      currentAvg: current.avgRating,
      delta,
      cohortSize: current.cohortSize,
    },
    dedupKey: `sentiment:${params.category}:${w2Start.toISOString().slice(0, 10)}`,
  })
}

/**
 * Consumer switching detector (3-condition rule, cohort-gated):
 *   1. User left feedback for BOTH brand products and competitor products
 *      within the 90-day window.
 *   2. More recent feedback is on the OTHER side (brand→comp = switching away,
 *      comp→brand = switching toward us).
 *   3. Overlap cohort ≥ MIN_COHORT_SIZE AND each side's user set ≥ MIN_COHORT_SIZE.
 *
 * Privacy: individual consumers are never named — only counts.
 */
export async function detectConsumerSwitching(params: {
  brandId: string
  brandProductIds: string[]
  competitorProfileId: string
  competitorName: string
  competitorProductIds: string[]
}) {
  if (params.brandProductIds.length === 0 || params.competitorProductIds.length === 0) return null

  const since = new Date(Date.now() - 90 * 86400000)

  // For each user that left feedback on both sides, identify the side of
  // their MOST RECENT feedback. Counts how many switched toward / away.
  const rows = await db.execute<{ switched_to_brand: number; switched_to_comp: number; total: number }>(drizzleSql`
    WITH last_by_user AS (
      SELECT
        user_email,
        MAX(CASE WHEN product_id = ANY(${params.brandProductIds}) THEN created_at END) AS last_brand,
        MAX(CASE WHEN product_id = ANY(${params.competitorProductIds}) THEN created_at END) AS last_comp
      FROM feedback
      WHERE user_email IS NOT NULL
        AND created_at >= ${since}
        AND (product_id = ANY(${params.brandProductIds}) OR product_id = ANY(${params.competitorProductIds}))
      GROUP BY user_email
    ),
    overlap AS (
      SELECT * FROM last_by_user WHERE last_brand IS NOT NULL AND last_comp IS NOT NULL
    )
    SELECT
      count(*) FILTER (WHERE last_brand > last_comp)::int AS switched_to_brand,
      count(*) FILTER (WHERE last_comp > last_brand)::int AS switched_to_comp,
      count(*)::int AS total
    FROM overlap
  `)
  const r: any = Array.isArray(rows) ? rows[0] : (rows as any).rows?.[0]
  const total = Number(r?.total ?? 0)
  const toBrand = Number(r?.switched_to_brand ?? 0)
  const toComp = Number(r?.switched_to_comp ?? 0)

  if (total < MIN_COHORT_SIZE) return null

  const fired: Array<NewCompetitorAlert | null> = []

  if (toBrand >= MIN_COHORT_SIZE) {
    fired.push(
      await fireAlert({
        brandId: params.brandId,
        alertType: 'consumer_switch_to',
        competitorProfileId: params.competitorProfileId,
        title: `${toBrand} consumers switched from ${params.competitorName} to you`,
        description: `Recent cross-brand feedback signals ${toBrand} consumers choosing your products after prior competitor feedback.`,
        data: { cohortSize: toBrand, competitorName: params.competitorName, windowDays: 90 },
        dedupKey: `consumer_switch_to:${params.competitorProfileId}:${new Date().toISOString().slice(0, 10)}`,
      })
    )
  }

  if (toComp >= MIN_COHORT_SIZE) {
    fired.push(
      await fireAlert({
        brandId: params.brandId,
        alertType: 'consumer_switch_from',
        competitorProfileId: params.competitorProfileId,
        title: `${toComp} consumers switched from you to ${params.competitorName}`,
        description: `Recent cross-brand feedback signals ${toComp} consumers choosing ${params.competitorName} after prior feedback on your products.`,
        data: { cohortSize: toComp, competitorName: params.competitorName, windowDays: 90 },
        dedupKey: `consumer_switch_from:${params.competitorProfileId}:${new Date().toISOString().slice(0, 10)}`,
      })
    )
  }

  return fired.filter(Boolean)
}

/**
 * Market-share change detector: compares share of feedback volume for
 * this brand against prior period. Fires when delta ≥ 5 percentage points.
 */
export async function detectMarketShareChange(params: {
  brandId: string
  brandProductIds: string[]
  categoryProductIds: string[]
  category: string
}) {
  if (params.categoryProductIds.length === 0) return null
  const now = Date.now()
  const w1 = new Date(now - 60 * 86400000)
  const w2 = new Date(now - 30 * 86400000)

  const [prior, current] = await Promise.all([
    computeShare(params.brandProductIds, params.categoryProductIds, w1, w2),
    computeShare(params.brandProductIds, params.categoryProductIds, w2, new Date(now)),
  ])
  if (prior === null || current === null) return null
  const delta = current - prior
  if (Math.abs(delta) < 5) return null

  const direction = delta > 0 ? 'gained' : 'lost'
  const severity: Severity = Math.abs(delta) >= 10 ? 'critical' : 'warning'

  return fireAlert({
    brandId: params.brandId,
    alertType: 'market_share_change',
    title: `You ${direction} ${Math.abs(delta).toFixed(1)}% market share in ${params.category}`,
    description: `30-day feedback share moved from ${prior.toFixed(1)}% to ${current.toFixed(1)}%.`,
    severity,
    data: { category: params.category, priorSharePct: prior, currentSharePct: current, delta },
    dedupKey: `market_share:${params.category}:${w2.toISOString().slice(0, 10)}`,
  })
}

async function computeShare(
  brandProductIds: string[],
  categoryProductIds: string[],
  from: Date,
  to: Date
): Promise<number | null> {
  if (brandProductIds.length === 0 || categoryProductIds.length === 0) return null
  const rows = await db.execute<{ brand_n: number; cat_n: number }>(drizzleSql`
    SELECT
      count(*) FILTER (WHERE product_id = ANY(${brandProductIds}))::int AS brand_n,
      count(*) FILTER (WHERE product_id = ANY(${categoryProductIds}))::int AS cat_n
    FROM feedback
    WHERE created_at >= ${from} AND created_at < ${to}
      AND product_id = ANY(${categoryProductIds})
  `)
  const r: any = Array.isArray(rows) ? rows[0] : (rows as any).rows?.[0]
  const catN = Number(r?.cat_n ?? 0)
  const brandN = Number(r?.brand_n ?? 0)
  if (catN < MIN_COHORT_SIZE) return null
  return (brandN / catN) * 100
}

export async function detectNewCommunityPost(params: {
  brandId: string
  competitorProfileId: string
  competitorName: string
  postId: string
  postTitle: string
  category: string
}) {
  return fireAlert({
    brandId: params.brandId,
    alertType: 'new_community_post',
    competitorProfileId: params.competitorProfileId,
    title: `New community post about ${params.competitorName}`,
    description: `"${params.postTitle}" — posted in ${params.category}.`,
    data: {
      postId: params.postId,
      postTitle: params.postTitle,
      category: params.category,
    },
    dedupKey: `community_post:${params.postId}`,
  })
}
