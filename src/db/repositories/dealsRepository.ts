import 'server-only'

import { db, sql } from '@/db'
import {
  deals,
  dealSaves,
  dealRedemptions,
  type NewDeal,
} from '@/db/schema'
import { eq, and, desc, asc, lt, gt, gte, lte, ilike, inArray, isNull, or, not } from 'drizzle-orm'

// ═══════════════════════════════════════════════════════════════════
// DEALS CRUD
// ═══════════════════════════════════════════════════════════════════

export async function createDeal(data: NewDeal) {
  const [deal] = await db.insert(deals).values(data).returning()
  return deal
}

export async function getDealById(id: string) {
  const [deal] = await db.select().from(deals).where(eq(deals.id, id)).limit(1)
  return deal ?? null
}

export async function updateDeal(id: string, data: Partial<NewDeal>) {
  const [deal] = await db.update(deals).set(data).where(eq(deals.id, id)).returning()
  return deal ?? null
}

export async function getDealsByBrand(
  brandId: string,
  filters?: { status?: string; cursor?: string; limit?: number }
) {
  const lim = filters?.limit ?? 20
  let query = db
    .select()
    .from(deals)
    .where(
      filters?.status
        ? and(eq(deals.brandId, brandId), eq(deals.status, filters.status))
        : eq(deals.brandId, brandId)
    )
    .orderBy(desc(deals.createdAt))
    .limit(lim + 1)

  if (filters?.cursor) {
    query = db
      .select()
      .from(deals)
      .where(
        and(
          eq(deals.brandId, brandId),
          filters?.status ? eq(deals.status, filters.status) : undefined,
          lt(deals.createdAt, new Date(filters.cursor))
        )
      )
      .orderBy(desc(deals.createdAt))
      .limit(lim + 1)
  }

  const rows = await query
  const hasMore = rows.length > lim
  return { deals: rows.slice(0, lim), nextCursor: hasMore ? rows[lim - 1].createdAt.toISOString() : null }
}

// ═══════════════════════════════════════════════════════════════════
// SEARCH (full-text via tsvector)
// ═══════════════════════════════════════════════════════════════════

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
  const lim = params.limit ?? 20
  const conditions: any[] = [eq(deals.status, 'active')]

  if (params.category) conditions.push(eq(deals.category, params.category))
  if (params.brandId) conditions.push(eq(deals.brandId, params.brandId))
  if (params.dealType) conditions.push(eq(deals.dealType, params.dealType))
  if (params.maxPrice) conditions.push(lte(deals.discountedPrice, params.maxPrice))
  if (params.cursor) conditions.push(lt(deals.createdAt, new Date(params.cursor)))

  // Full-text search
  if (params.q) {
    const tsQuery = params.q.trim().split(/\s+/).join(' & ')
    conditions.push(sql`search_vector @@ plainto_tsquery('english', ${params.q})`)
  }

  // Discount filter: for percentage_off, discount_value >= minDiscount
  if (params.minDiscount) {
    conditions.push(
      and(
        eq(deals.dealType, 'percentage_off'),
        gte(sql`CAST(discount_value AS NUMERIC)`, params.minDiscount)
      )
    )
  }

  let orderBy
  switch (params.sort) {
    case 'relevance':
      orderBy = params.q
        ? sql`ts_rank(search_vector, plainto_tsquery('english', ${params.q})) DESC`
        : desc(deals.createdAt)
      break
    case 'expiring_soon':
      orderBy = asc(deals.validUntil)
      break
    case 'most_redeemed':
      orderBy = desc(deals.redemptionCount)
      break
    case 'most_saved':
      orderBy = desc(deals.saveCount)
      break
    default:
      orderBy = desc(deals.createdAt)
  }

  const rows = await db
    .select()
    .from(deals)
    .where(and(...conditions))
    .orderBy(orderBy)
    .limit(lim + 1)

  const hasMore = rows.length > lim
  return {
    deals: rows.slice(0, lim),
    nextCursor: hasMore ? rows[lim - 1].createdAt.toISOString() : null,
  }
}

// ═══════════════════════════════════════════════════════════════════
// FEED SECTIONS
// ═══════════════════════════════════════════════════════════════════

export async function getFeaturedDeals(limit = 6) {
  return db
    .select()
    .from(deals)
    .where(and(eq(deals.status, 'active'), eq(deals.isFeatured, true)))
    .orderBy(desc(deals.createdAt))
    .limit(limit)
}

export async function getTrendingDeals(sinceHours = 24, limit = 10) {
  const since = new Date(Date.now() - sinceHours * 3600_000)
  return db
    .select()
    .from(deals)
    .where(and(eq(deals.status, 'active'), gte(deals.createdAt, since)))
    .orderBy(desc(deals.redemptionCount))
    .limit(limit)
}

export async function getExpiringDeals(withinHours = 48, limit = 10) {
  const now = new Date()
  const cutoff = new Date(Date.now() + withinHours * 3600_000)
  return db
    .select()
    .from(deals)
    .where(
      and(
        eq(deals.status, 'active'),
        gte(deals.validUntil, now),
        lte(deals.validUntil, cutoff)
      )
    )
    .orderBy(asc(deals.validUntil))
    .limit(limit)
}

export async function getNewDeals(sinceHours = 24, limit = 10) {
  const since = new Date(Date.now() - sinceHours * 3600_000)
  return db
    .select()
    .from(deals)
    .where(and(eq(deals.status, 'active'), gte(deals.createdAt, since)))
    .orderBy(desc(deals.createdAt))
    .limit(limit)
}

export async function getMostSavedDeals(limit = 10) {
  return db
    .select()
    .from(deals)
    .where(and(eq(deals.status, 'active'), gt(deals.saveCount, 0)))
    .orderBy(desc(deals.saveCount))
    .limit(limit)
}

export async function getDealsByCategories(categories: string[], limit = 20) {
  if (categories.length === 0) return []
  return db
    .select()
    .from(deals)
    .where(and(eq(deals.status, 'active'), inArray(deals.category, categories)))
    .orderBy(desc(deals.createdAt))
    .limit(limit)
}

// ═══════════════════════════════════════════════════════════════════
// STATS UPDATE
// ═══════════════════════════════════════════════════════════════════

export async function incrementDealStat(id: string, field: 'view_count' | 'save_count' | 'redemption_count', delta = 1) {
  await db.execute(
    sql`UPDATE deals SET ${sql.identifier(field)} = ${sql.identifier(field)} + ${delta} WHERE id = ${id}`
  )
}

// ═══════════════════════════════════════════════════════════════════
// DEAL SAVES
// ═══════════════════════════════════════════════════════════════════

export async function saveDeal(dealId: string, userId: string) {
  try {
    await db.insert(dealSaves).values({ dealId, userId })
    await incrementDealStat(dealId, 'save_count', 1)
    return true
  } catch (err: any) {
    if (err?.message?.includes('23505') || err?.code === '23505') return false // already saved
    throw err
  }
}

export async function unsaveDeal(dealId: string, userId: string) {
  const [deleted] = await db
    .delete(dealSaves)
    .where(and(eq(dealSaves.dealId, dealId), eq(dealSaves.userId, userId)))
    .returning()
  if (deleted) await incrementDealStat(dealId, 'save_count', -1)
  return !!deleted
}

export async function isDealSaved(dealId: string, userId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: dealSaves.id })
    .from(dealSaves)
    .where(and(eq(dealSaves.dealId, dealId), eq(dealSaves.userId, userId)))
    .limit(1)
  return !!row
}

export async function getSavedDeals(userId: string, cursor?: string, limit = 20) {
  const conditions: any[] = [eq(dealSaves.userId, userId)]
  if (cursor) conditions.push(lt(dealSaves.savedAt, new Date(cursor)))

  const rows = await db
    .select({ dealId: dealSaves.dealId, savedAt: dealSaves.savedAt })
    .from(dealSaves)
    .where(and(...conditions))
    .orderBy(desc(dealSaves.savedAt))
    .limit(limit + 1)

  const hasMore = rows.length > limit
  const dealIds = rows.slice(0, limit).map(r => r.dealId)

  if (dealIds.length === 0) return { deals: [], nextCursor: null }

  const dealRows = await db.select().from(deals).where(inArray(deals.id, dealIds))
  const dealMap = Object.fromEntries(dealRows.map(d => [d.id, d]))
  const ordered = dealIds.map(id => dealMap[id]).filter(Boolean)

  return {
    deals: ordered,
    nextCursor: hasMore ? rows[limit - 1].savedAt.toISOString() : null,
  }
}

// ═══════════════════════════════════════════════════════════════════
// DEAL REDEMPTIONS
// ═══════════════════════════════════════════════════════════════════

export async function createRedemption(data: {
  dealId: string
  consumerId: string
  redemptionType: string
  pointsAwarded?: number
}) {
  const [row] = await db.insert(dealRedemptions).values({
    dealId: data.dealId,
    consumerId: data.consumerId,
    redemptionType: data.redemptionType,
    pointsAwarded: data.pointsAwarded ?? 10,
  }).returning()
  return row
}

export async function getRedemption(dealId: string, consumerId: string) {
  const [row] = await db
    .select()
    .from(dealRedemptions)
    .where(and(eq(dealRedemptions.dealId, dealId), eq(dealRedemptions.consumerId, consumerId)))
    .limit(1)
  return row ?? null
}

export async function getRedemptionsByConsumer(consumerId: string, cursor?: string, limit = 20) {
  const conditions: any[] = [eq(dealRedemptions.consumerId, consumerId)]
  if (cursor) conditions.push(lt(dealRedemptions.redeemedAt, new Date(cursor)))

  const rows = await db
    .select()
    .from(dealRedemptions)
    .where(and(...conditions))
    .orderBy(desc(dealRedemptions.redeemedAt))
    .limit(limit + 1)

  const hasMore = rows.length > limit
  return {
    redemptions: rows.slice(0, limit),
    nextCursor: hasMore ? rows[limit - 1].redeemedAt.toISOString() : null,
  }
}

export async function getRedemptionCount(dealId: string) {
  const [row] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(dealRedemptions)
    .where(eq(dealRedemptions.dealId, dealId))
  return row?.count ?? 0
}

// ═══════════════════════════════════════════════════════════════════
// EXPIRY HELPERS
// ═══════════════════════════════════════════════════════════════════

export async function getExpiredActiveDeals() {
  return db
    .select()
    .from(deals)
    .where(
      and(
        eq(deals.status, 'active'),
        lt(deals.validUntil, new Date())
      )
    )
    .limit(200)
}

export async function markDealsExpired(ids: string[]) {
  if (ids.length === 0) return
  await db
    .update(deals)
    .set({ status: 'expired' })
    .where(inArray(deals.id, ids))
}

export async function getConsumersWhoSavedDeal(dealId: string) {
  return db
    .select({ userId: dealSaves.userId })
    .from(dealSaves)
    .where(eq(dealSaves.dealId, dealId))
}

// ═══════════════════════════════════════════════════════════════════
// BRAND ANALYTICS
// ═══════════════════════════════════════════════════════════════════

export async function getDealAnalytics(dealId: string) {
  const deal = await getDealById(dealId)
  if (!deal) return null

  const redemptionCount = await getRedemptionCount(dealId)

  return {
    viewCount: deal.viewCount,
    saveCount: deal.saveCount,
    redemptionCount,
    status: deal.status,
    createdAt: deal.createdAt,
    validUntil: deal.validUntil,
  }
}
