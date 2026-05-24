/**
 * GET /api/community/trending
 *
 * Returns the top trending social-post keywords for the community
 * "Trending now" banner.
 *
 * Query params (all optional):
 *   days     1–90, default 7
 *   category restrict to a product category
 *   limit    1–50, default 10
 *
 * Auth: same session gate as the rest of the dashboard.
 * The banner hides silently on any non-200, so we never throw — we
 * return `{ keywords: [] }` and log the error.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { getTrendingKeywords } from '@/server/community/trendingSocialService'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = req.nextUrl
    const days     = parseInt(searchParams.get('days')  ?? '7',  10)
    const limit    = parseInt(searchParams.get('limit') ?? '10', 10)
    const category = searchParams.get('category') ?? undefined

    const keywords = await getTrendingKeywords({
      days:     Number.isFinite(days)  ? days  : 7,
      limit:    Number.isFinite(limit) ? limit : 10,
      category: category && category.trim().length > 0 ? category : undefined,
    })

    return NextResponse.json({ keywords })
  } catch (err) {
    console.error('[GET /api/community/trending] error:', err)
    return NextResponse.json({ keywords: [] })
  }
}
