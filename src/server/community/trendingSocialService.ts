/**
 * Trending Social Keywords for the Community Feed
 *
 * Aggregates the `keywords` jsonb arrays already populated by every
 * platform adapter into a small list of the most-mentioned terms over
 * a recent time window. The community feed surfaces this as a
 * "Trending now" banner so consumers see what the platforms-at-large
 * are talking about within Earn4Insights' categories.
 *
 * Purely additive — reads only from `social_posts`, writes nothing.
 * If this service fails or returns [], the banner hides silently and
 * the community feed is unaffected.
 */

import 'server-only'

import { db } from '@/db'
import { sql } from 'drizzle-orm'

export type TrendingKeyword = {
  keyword: string
  count: number
  platforms: string[]   // distinct platforms where the keyword appeared
}

export type TrendingOptions = {
  days?: number         // window size; default 7
  category?: string     // restrict to product.category (case-insensitive); optional
  limit?: number        // default 10
}

// ────────────────────────────────────────────────────────────────────
// In-memory cache. Vercel's serverless model means each warm function
// instance has its own cache, so this is best-effort, not a global
// cache — still useful to amortise the aggregate across rapid repeat
// hits on the same instance. Cleared on cold start.
// ────────────────────────────────────────────────────────────────────
type CacheEntry = { value: TrendingKeyword[]; expiresAt: number }
const CACHE_TTL_MS = 10 * 60 * 1000   // 10 minutes
const cache = new Map<string, CacheEntry>()

function cacheKey(days: number, category: string | undefined): string {
  return `${days}|${(category ?? 'all').toLowerCase()}`
}

/**
 * Get the top trending keywords from recent social_posts.
 *
 * The aggregate UNNESTs the jsonb keywords array and groups by the
 * lower-cased keyword. Stop-words are already excluded at extract time
 * (see `extractKeywords` in platformAdapters.ts), but we also drop
 * keywords shorter than 3 characters here as a second-line filter.
 */
export async function getTrendingKeywords(
  options: TrendingOptions = {},
): Promise<TrendingKeyword[]> {
  const days = Math.max(1, Math.min(options.days ?? 7, 90))
  const limit = Math.max(1, Math.min(options.limit ?? 10, 50))
  const category = options.category?.trim()

  const key = cacheKey(days, category)
  const now = Date.now()
  const cached = cache.get(key)
  if (cached && cached.expiresAt > now) {
    return cached.value
  }

  try {
    // Drizzle's `sql` template tag parameterises values safely; the
    // jsonb UNNEST happens via `jsonb_array_elements_text(keywords)`
    // (jsonb, not text[], because schema declares jsonb on this column).
    //
    // We branch the SQL on `category` rather than composing a fragment
    // because Drizzle's sql composition is fiddly and these are the
    // only two shapes we ever need.
    const rows = category
      ? await db.execute(sql`
          SELECT
            LOWER(kw)                       AS keyword,
            COUNT(*)::int                   AS count,
            ARRAY_AGG(DISTINCT sp.platform) AS platforms
          FROM social_posts sp
          JOIN products p ON p.id = sp.product_id,
            LATERAL jsonb_array_elements_text(sp.keywords) AS kw
          WHERE sp.posted_at >= NOW() - (${days}::int * INTERVAL '1 day')
            AND LENGTH(kw) >= 3
            AND LOWER(COALESCE(p.profile->>'categoryName', p.profile->>'category', '')) = LOWER(${category})
          GROUP BY LOWER(kw)
          ORDER BY count DESC, keyword ASC
          LIMIT ${limit}
        `)
      : await db.execute(sql`
          SELECT
            LOWER(kw)                       AS keyword,
            COUNT(*)::int                   AS count,
            ARRAY_AGG(DISTINCT sp.platform) AS platforms
          FROM social_posts sp,
            LATERAL jsonb_array_elements_text(sp.keywords) AS kw
          WHERE sp.posted_at >= NOW() - (${days}::int * INTERVAL '1 day')
            AND LENGTH(kw) >= 3
          GROUP BY LOWER(kw)
          ORDER BY count DESC, keyword ASC
          LIMIT ${limit}
        `)

    // postgres.js returns rows as an array-like; normalise to our shape.
    const value: TrendingKeyword[] = (rows as unknown as Array<{
      keyword: string
      count: number
      platforms: string[] | null
    }>).map((r) => ({
      keyword: r.keyword,
      count: r.count,
      platforms: (r.platforms ?? []).filter(Boolean),
    }))

    cache.set(key, { value, expiresAt: now + CACHE_TTL_MS })
    return value
  } catch (err) {
    // Defensive: a malformed jsonb row or a missing column shouldn't
    // tank the community feed. Return empty and log for observability.
    console.error('[trendingSocialService] error:', err)
    return []
  }
}

/**
 * For tests / admin diagnostics — drop the cache.
 */
export function clearTrendingCache(): void {
  cache.clear()
}
