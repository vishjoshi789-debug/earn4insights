import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { validateCsrfToken, csrfErrorResponse } from '@/lib/csrf'
import { supportReadRateLimit } from '@/lib/rate-limit-upstash'
import { findArticleBySlug } from '@/db/repositories/supportRepository'
import { rateArticle } from '@/server/faqService'

/**
 * POST /api/support/faq/[slug]/rate
 * Body: { helpful: boolean }
 * Auth required to prevent unauthenticated vote-stuffing. Per-user
 * dedup is intentionally NOT enforced — repeated votes increment the
 * counter (analytics-grade signal, not ballot). Rate limit is the
 * primary anti-spam control.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!validateCsrfToken(req)) return csrfErrorResponse()
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = (session.user as any).id as string

    const rl = await supportReadRateLimit.limit(userId)
    if (!rl.success) {
      return NextResponse.json({ error: 'Too many requests.' }, { status: 429 })
    }

    const { slug } = await params
    if (!slug) return NextResponse.json({ error: 'Slug required' }, { status: 400 })

    const body = await req.json().catch(() => null)
    const helpful = body && typeof body.helpful === 'boolean' ? body.helpful : null
    if (helpful === null) return NextResponse.json({ error: 'helpful (boolean) required' }, { status: 400 })

    const article = await findArticleBySlug(slug)
    if (!article || !article.isPublished) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    await rateArticle({ articleId: article.id, helpful, userId })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[support/faq/[slug]/rate POST] error:', err)
    return NextResponse.json({ error: 'Failed to rate article' }, { status: 500 })
  }
}
