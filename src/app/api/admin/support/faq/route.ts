import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { validateCsrfToken, csrfErrorResponse } from '@/lib/csrf'
import { supportAdminRateLimit } from '@/lib/rate-limit-upstash'
import { createArticleWithEmbedding } from '@/server/faqService'
import { listFaqArticles, findArticleBySlug } from '@/db/repositories/supportRepository'
import type { FaqArticle } from '@/db/schema'

const VALID_CATEGORIES: ReadonlyArray<FaqArticle['category']> = [
  'getting_started', 'account', 'payments', 'campaigns', 'feedback',
  'deals', 'community', 'influencer', 'competitive_intel', 'privacy',
  'technical', 'billing',
]
const VALID_ROLES = ['brand', 'consumer', 'influencer']

/**
 * GET /api/admin/support/faq
 * Admin list — includes unpublished drafts. Filters: ?category, ?role, ?limit, ?offset.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = (session.user as any).id as string
    const role = (session.user as any).role as string
    if (role !== 'admin') return NextResponse.json({ error: 'Admin access only' }, { status: 403 })

    const rl = await supportAdminRateLimit.limit(userId)
    if (!rl.success) {
      return NextResponse.json({ error: 'Too many requests.' }, { status: 429 })
    }

    const sp = req.nextUrl.searchParams
    const category = sp.get('category') as FaqArticle['category'] | null
    const roleFilter = sp.get('role')
    const limit = Math.min(200, Math.max(1, parseInt(sp.get('limit') || '50')))
    const offset = Math.max(0, parseInt(sp.get('offset') || '0'))

    const articles = await listFaqArticles(
      {
        category: category && VALID_CATEGORIES.includes(category) ? category : undefined,
        role: roleFilter || undefined,
        publishedOnly: false, // admin sees drafts
      },
      limit,
      offset
    )
    return NextResponse.json({ articles, pagination: { limit, offset, count: articles.length } })
  } catch (err) {
    console.error('[admin/support/faq GET] error:', err)
    return NextResponse.json({ error: 'Failed to list articles' }, { status: 500 })
  }
}

/**
 * POST /api/admin/support/faq
 * Create a new FAQ article (auto-generates embedding for chatbot semantic search).
 * Body: { slug, title, content, excerpt, category, targetRoles?, tags?, isPublished?, displayOrder? }
 */
export async function POST(req: NextRequest) {
  if (!validateCsrfToken(req)) return csrfErrorResponse()
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = (session.user as any).id as string
    const role = (session.user as any).role as string
    if (role !== 'admin') return NextResponse.json({ error: 'Admin access only' }, { status: 403 })

    const rl = await supportAdminRateLimit.limit(userId)
    if (!rl.success) {
      return NextResponse.json({ error: 'Too many requests.' }, { status: 429 })
    }

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const slug = typeof body.slug === 'string' ? body.slug.trim().toLowerCase() : ''
    const title = typeof body.title === 'string' ? body.title.trim() : ''
    const content = typeof body.content === 'string' ? body.content.trim() : ''
    const excerpt = typeof body.excerpt === 'string' ? body.excerpt.trim() : ''
    const category = body.category as FaqArticle['category']

    if (!/^[a-z0-9-]+$/.test(slug) || slug.length > 100) {
      return NextResponse.json({ error: 'slug must be kebab-case lowercase (≤100 chars)' }, { status: 400 })
    }
    if (!title || title.length > 200) return NextResponse.json({ error: 'title required (≤200 chars)' }, { status: 400 })
    if (!content) return NextResponse.json({ error: 'content required' }, { status: 400 })
    if (!excerpt || excerpt.length > 500) {
      return NextResponse.json({ error: 'excerpt required (≤500 chars)' }, { status: 400 })
    }
    if (!category || !VALID_CATEGORIES.includes(category)) {
      return NextResponse.json({ error: 'invalid category' }, { status: 400 })
    }

    if (await findArticleBySlug(slug)) {
      return NextResponse.json({ error: 'An article with this slug already exists' }, { status: 409 })
    }

    const targetRoles = Array.isArray(body.targetRoles)
      ? (body.targetRoles as unknown[])
          .filter((r): r is string => typeof r === 'string' && VALID_ROLES.includes(r))
      : []
    const tags = Array.isArray(body.tags)
      ? (body.tags as unknown[])
          .filter((t): t is string => typeof t === 'string')
          .slice(0, 20)
          .map((t) => t.slice(0, 50))
      : []
    const isPublished = typeof body.isPublished === 'boolean' ? body.isPublished : true
    const displayOrder = typeof body.displayOrder === 'number' ? Math.floor(body.displayOrder) : 0

    const article = await createArticleWithEmbedding({
      slug,
      title,
      content,
      excerpt,
      category,
      targetRoles,
      tags,
      isPublished,
      displayOrder,
      viewCount: 0,
      helpfulCount: 0,
      notHelpfulCount: 0,
    })
    return NextResponse.json({ article }, { status: 201 })
  } catch (err) {
    console.error('[admin/support/faq POST] error:', err)
    return NextResponse.json({ error: 'Failed to create article' }, { status: 500 })
  }
}
