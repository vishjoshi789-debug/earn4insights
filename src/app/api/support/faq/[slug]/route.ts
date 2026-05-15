import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { supportReadRateLimit } from '@/lib/rate-limit-upstash'
import { getArticleBySlug } from '@/server/faqService'

/**
 * GET /api/support/faq/[slug]
 * Returns the full article. Increments view_count and logs `faq_viewed`
 * analytics (for signed-in viewers).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await auth()
    const userId = ((session?.user as any)?.id as string) ?? null
    const limiterKey = userId
      ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      ?? 'anon'

    const rl = await supportReadRateLimit.limit(limiterKey)
    if (!rl.success) {
      return NextResponse.json({ error: 'Too many requests.' }, { status: 429 })
    }

    const { slug } = await params
    if (!slug) return NextResponse.json({ error: 'Slug required' }, { status: 400 })

    const article = await getArticleBySlug(slug, { userId: userId ?? undefined })
    if (!article || !article.isPublished) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json({ article })
  } catch (err) {
    console.error('[support/faq/[slug] GET] error:', err)
    return NextResponse.json({ error: 'Failed to load article' }, { status: 500 })
  }
}
