import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { validateCsrfToken, csrfErrorResponse } from '@/lib/csrf'
import { supportAdminRateLimit } from '@/lib/rate-limit-upstash'
import { updateArticleWithEmbedding, deleteArticleById } from '@/server/faqService'
import { findArticleById, findArticleBySlug } from '@/db/repositories/supportRepository'
import type { FaqArticle, NewFaqArticle } from '@/db/schema'

const VALID_CATEGORIES: ReadonlyArray<FaqArticle['category']> = [
  'getting_started', 'account', 'payments', 'campaigns', 'feedback',
  'deals', 'community', 'influencer', 'competitive_intel', 'privacy',
  'technical', 'billing',
]
const VALID_ROLES = ['brand', 'consumer', 'influencer']

/**
 * PUT /api/admin/support/faq/[id]
 * Update an FAQ article. Auto-regenerates embedding when title/excerpt/content changes.
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params
    if (!id) return NextResponse.json({ error: 'Article id required' }, { status: 400 })

    const existing = await findArticleById(id)
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const patch: Partial<Omit<NewFaqArticle, 'id' | 'createdAt'>> = {}

    if (typeof body.slug === 'string') {
      const newSlug = body.slug.trim().toLowerCase()
      if (!/^[a-z0-9-]+$/.test(newSlug) || newSlug.length > 100) {
        return NextResponse.json({ error: 'invalid slug' }, { status: 400 })
      }
      if (newSlug !== existing.slug) {
        const dup = await findArticleBySlug(newSlug)
        if (dup) return NextResponse.json({ error: 'slug already taken' }, { status: 409 })
        patch.slug = newSlug
      }
    }
    if (typeof body.title === 'string') {
      const v = body.title.trim()
      if (!v || v.length > 200) return NextResponse.json({ error: 'invalid title' }, { status: 400 })
      patch.title = v
    }
    if (typeof body.content === 'string') {
      const v = body.content.trim()
      if (!v) return NextResponse.json({ error: 'content cannot be empty' }, { status: 400 })
      patch.content = v
    }
    if (typeof body.excerpt === 'string') {
      const v = body.excerpt.trim()
      if (!v || v.length > 500) return NextResponse.json({ error: 'invalid excerpt' }, { status: 400 })
      patch.excerpt = v
    }
    if (typeof body.category === 'string') {
      if (!VALID_CATEGORIES.includes(body.category as FaqArticle['category'])) {
        return NextResponse.json({ error: 'invalid category' }, { status: 400 })
      }
      patch.category = body.category as FaqArticle['category']
    }
    if (Array.isArray(body.targetRoles)) {
      patch.targetRoles = (body.targetRoles as unknown[])
        .filter((r): r is string => typeof r === 'string' && VALID_ROLES.includes(r))
    }
    if (Array.isArray(body.tags)) {
      patch.tags = (body.tags as unknown[])
        .filter((t): t is string => typeof t === 'string')
        .slice(0, 20)
        .map((t) => t.slice(0, 50))
    }
    if (typeof body.isPublished === 'boolean') patch.isPublished = body.isPublished
    if (typeof body.displayOrder === 'number') patch.displayOrder = Math.floor(body.displayOrder)

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
    }

    const article = await updateArticleWithEmbedding(id, patch)
    return NextResponse.json({ article })
  } catch (err) {
    console.error('[admin/support/faq/[id] PUT] error:', err)
    return NextResponse.json({ error: 'Failed to update article' }, { status: 500 })
  }
}

/**
 * DELETE /api/admin/support/faq/[id]
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params
    if (!id) return NextResponse.json({ error: 'Article id required' }, { status: 400 })

    const existing = await findArticleById(id)
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await deleteArticleById(id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[admin/support/faq/[id] DELETE] error:', err)
    return NextResponse.json({ error: 'Failed to delete article' }, { status: 500 })
  }
}
