import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { supportReadRateLimit } from '@/lib/rate-limit-upstash'
import { listArticles } from '@/server/faqService'
import type { FaqArticle } from '@/db/schema'

const VALID_CATEGORIES: ReadonlyArray<FaqArticle['category']> = [
  'getting_started', 'account', 'payments', 'campaigns', 'feedback',
  'deals', 'community', 'influencer', 'competitive_intel', 'privacy',
  'technical', 'billing',
]

/**
 * GET /api/support/faq
 * Returns published FAQ articles. Filters: ?category, ?role, ?search, ?limit, ?offset.
 * The public /help page hits this without a session; the in-widget FAQ
 * tab hits it with a session for the role filter.
 */
export async function GET(req: NextRequest) {
  try {
    // Auth optional — /help is public; widget is authenticated.
    const session = await auth()
    const userId = ((session?.user as any)?.id as string) ?? null

    // Rate-limit by user when signed in, else by IP (forwarded-for header).
    const limiterKey = userId
      ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      ?? 'anon'
    const rl = await supportReadRateLimit.limit(limiterKey)
    if (!rl.success) {
      return NextResponse.json({ error: 'Too many requests.' }, { status: 429 })
    }

    const sp = req.nextUrl.searchParams
    const category = sp.get('category') as FaqArticle['category'] | null
    const role = sp.get('role')
    const search = sp.get('search')?.trim() || undefined
    const limit = Math.min(50, Math.max(1, parseInt(sp.get('limit') || '20')))
    const offset = Math.max(0, parseInt(sp.get('offset') || '0'))

    const articles = await listArticles({
      category: category && VALID_CATEGORIES.includes(category) ? category : undefined,
      role: role || undefined,
      search,
      limit,
      offset,
    })

    return NextResponse.json({ articles, pagination: { limit, offset, count: articles.length } })
  } catch (err) {
    console.error('[support/faq GET] error:', err)
    return NextResponse.json({ error: 'Failed to list articles' }, { status: 500 })
  }
}
