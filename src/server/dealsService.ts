/**
 * Deals Service
 *
 * Business logic for brand deal listings:
 * - Brand CRUD: create, update, publish, pause deals
 * - Consumer actions: redeem, save/unsave, browse feed
 * - Personalized feed: featured + trending + expiring + category-matched
 * - Search with full-text + filters
 */

import 'server-only'

import {
  createDeal as createDealRepo,
  getDealById,
  updateDeal as updateDealRepo,
  getDealsByBrand,
  searchDeals as searchDealsRepo,
  getFeaturedDeals,
  getTrendingDeals,
  getExpiringDeals,
  getNewDeals,
  getMostSavedDeals,
  getDealsByCategories,
  incrementDealStat,
  saveDeal as saveDealRepo,
  unsaveDeal as unsaveDealRepo,
  isDealSaved,
  getSavedDeals as getSavedDealsRepo,
  createRedemption,
  getRedemption,
  getRedemptionsByConsumer,
  getDealAnalytics as getDealAnalyticsRepo,
  getExpiredActiveDeals,
  markDealsExpired,
  getConsumersWhoSavedDeal,
} from '@/db/repositories/dealsRepository'
import { type NewDeal } from '@/db/schema'
import { awardPoints, POINT_VALUES } from '@/server/pointsService'
import { emit, PLATFORM_EVENTS } from '@/server/eventBus'

// ── Brand: Create Deal ───────────────────────────────────────────

export async function createBrandDeal(brandId: string, data: Omit<NewDeal, 'brandId'>) {
  const deal = await createDealRepo({ ...data, brandId })
  return deal
}

// ── Brand: Update Deal ───────────────────────────────────────────

export async function updateBrandDeal(brandId: string, dealId: string, data: Partial<NewDeal>) {
  const deal = await getDealById(dealId)
  if (!deal) throw new Error('Deal not found')
  if (deal.brandId !== brandId) throw new Error('Forbidden')

  // Don't allow changing brandId
  const { brandId: _, ...safeData } = data as any
  return updateDealRepo(dealId, safeData)
}

// ── Brand: Publish / Pause ───────────────────────────────────────

export async function publishDeal(brandId: string, dealId: string) {
  const deal = await getDealById(dealId)
  if (!deal) throw new Error('Deal not found')
  if (deal.brandId !== brandId) throw new Error('Forbidden')
  if (deal.status === 'active') return deal

  const updated = await updateDealRepo(dealId, { status: 'active' })

  emit(PLATFORM_EVENTS.BRAND_DISCOUNT_CREATED, {
    actorId: brandId,
    actorRole: 'brand',
    brandId,
    dealId,
    dealTitle: deal.title,
  })

  return updated
}

export async function pauseDeal(brandId: string, dealId: string) {
  const deal = await getDealById(dealId)
  if (!deal) throw new Error('Deal not found')
  if (deal.brandId !== brandId) throw new Error('Forbidden')

  return updateDealRepo(dealId, { status: 'paused' })
}

// ── Brand: Get Own Deals ─────────────────────────────────────────

export async function getBrandDeals(
  brandId: string,
  filters?: { status?: string; cursor?: string; limit?: number }
) {
  return getDealsByBrand(brandId, filters)
}

// ── Brand: Analytics ─────────────────────────────────────────────

export async function getBrandDealAnalytics(brandId: string, dealId: string) {
  const deal = await getDealById(dealId)
  if (!deal) throw new Error('Deal not found')
  if (deal.brandId !== brandId) throw new Error('Forbidden')

  return getDealAnalyticsRepo(dealId)
}

// ── Consumer: View Deal ──────────────────────────────────────────

export async function viewDeal(dealId: string, userId?: string) {
  const deal = await getDealById(dealId)
  if (!deal || deal.status !== 'active') return null

  // Fire-and-forget view count increment
  incrementDealStat(dealId, 'view_count').catch(() => {})

  let saved = false
  let redeemed = false
  if (userId) {
    const [isSaved, existingRedemption] = await Promise.all([
      isDealSaved(dealId, userId),
      getRedemption(dealId, userId),
    ])
    saved = isSaved
    redeemed = !!existingRedemption
  }

  return { ...deal, viewCount: deal.viewCount + 1, isSaved: saved, isRedeemed: redeemed }
}

// ── Consumer: Redeem Deal ────────────────────────────────────────

export async function redeemDeal(dealId: string, consumerId: string) {
  const deal = await getDealById(dealId)
  if (!deal) throw new Error('Deal not found')
  if (deal.status !== 'active') throw new Error('Deal is not active')

  // Check if already redeemed
  const existing = await getRedemption(dealId, consumerId)
  if (existing) return { redemption: existing, alreadyRedeemed: true }

  // Check max redemptions
  if (deal.maxRedemptions && deal.redemptionCount >= deal.maxRedemptions) {
    throw new Error('Deal has reached maximum redemptions')
  }

  // Determine redemption type
  const redemptionType = deal.promoCode ? 'promo_code' : 'redirect'

  const redemption = await createRedemption({
    dealId,
    consumerId,
    redemptionType,
    pointsAwarded: 10,
  })

  // Increment redemption_count on deal
  await incrementDealStat(dealId, 'redemption_count')

  // Award points
  await awardPoints(consumerId, 10, 'deal_redemption', dealId, `Redeemed deal: ${deal.title}`)

  return { redemption, alreadyRedeemed: false }
}

// ── Consumer: Save / Unsave ──────────────────────────────────────

export async function toggleSaveDeal(dealId: string, userId: string) {
  const deal = await getDealById(dealId)
  if (!deal) throw new Error('Deal not found')

  const alreadySaved = await isDealSaved(dealId, userId)
  if (alreadySaved) {
    await unsaveDealRepo(dealId, userId)
    return { saved: false }
  } else {
    await saveDealRepo(dealId, userId)
    return { saved: true }
  }
}

export async function getUserSavedDeals(userId: string, cursor?: string, limit = 20) {
  return getSavedDealsRepo(userId, cursor, limit)
}

// ── Consumer: Redemption History ─────────────────────────────────

export async function getUserRedemptions(consumerId: string, cursor?: string, limit = 20) {
  return getRedemptionsByConsumer(consumerId, cursor, limit)
}

// ── Consumer: Deal Feed (personalized) ───────────────────────────

export async function getDealFeed(userInterests?: string[]) {
  const [featured, trending, expiring, newest, mostSaved, forYou] = await Promise.all([
    getFeaturedDeals(6),
    getTrendingDeals(24, 10),
    getExpiringDeals(48, 10),
    getNewDeals(24, 10),
    getMostSavedDeals(10),
    userInterests && userInterests.length > 0
      ? getDealsByCategories(userInterests, 10)
      : Promise.resolve([]),
  ])

  return { featured, trending, expiring, newest, mostSaved, forYou }
}

// ── Search ───────────────────────────────────────────────────────

export async function searchDeals(params: {
  q?: string
  category?: string
  brandId?: string
  dealType?: string
  minDiscount?: number
  maxPrice?: number
  sort?: 'relevance' | 'newest' | 'expiring_soon' | 'most_redeemed' | 'most_saved'
  cursor?: string
  limit?: number
}) {
  return searchDealsRepo(params)
}

// ── Expiry Processing (cron) ─────────────────────────────────────

export async function processExpiredDeals() {
  const expired = await getExpiredActiveDeals()
  if (expired.length === 0) return { processed: 0 }

  const ids = expired.map(d => d.id)
  await markDealsExpired(ids)

  // Notify consumers who saved these deals
  for (const deal of expired) {
    const savers = await getConsumersWhoSavedDeal(deal.id)
    if (savers.length > 0) {
      // Fire event — eventBus handles notification dispatch
      emit(PLATFORM_EVENTS.BRAND_DISCOUNT_CREATED, {
        actorId: deal.brandId,
        actorRole: 'brand',
        brandId: deal.brandId,
        dealId: deal.id,
        dealTitle: deal.title,
        expired: true,
      }).catch(() => {})
    }
  }

  return { processed: ids.length }
}
