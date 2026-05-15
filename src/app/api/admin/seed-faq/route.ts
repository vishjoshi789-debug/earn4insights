import { NextRequest, NextResponse } from 'next/server'
import {
  findArticleBySlug,
  createArticle,
  setArticleEmbedding,
} from '@/db/repositories/supportRepository'
import { FAQ_SEED_ARTICLES } from '@/server/faqSeedData'
import { generateEmbedding } from '@/lib/embeddings'

/**
 * Seed FAQ knowledge base.
 * POST /api/admin/seed-faq
 * Header: x-api-key: <ADMIN_API_KEY>
 *
 * Idempotent — skips slugs that already exist. Safe to re-run.
 *
 * For each new article:
 *   1. Insert the row (search_vector populated by DB trigger).
 *   2. Generate an OpenAI embedding (title + excerpt + content) and
 *      UPDATE the embedding column.
 *
 * Run AFTER migration 015. Requires OPENAI_API_KEY.
 *
 * Re-seeding does NOT overwrite existing articles — edit articles via
 * the admin FAQ UI (Phase 7) instead. If you need to regenerate embeddings
 * on existing articles, use the admin re-embed flow (Phase 2).
 */
export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key')
  if (!process.env.ADMIN_API_KEY || apiKey !== process.env.ADMIN_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: 'OPENAI_API_KEY not configured — required to generate FAQ embeddings' },
      { status: 500 }
    )
  }

  const summary = { total: FAQ_SEED_ARTICLES.length, created: 0, skipped: 0, errors: [] as string[] }

  for (const article of FAQ_SEED_ARTICLES) {
    try {
      const existing = await findArticleBySlug(article.slug)
      if (existing) {
        summary.skipped += 1
        continue
      }

      const row = await createArticle(article)

      // Embed title + excerpt + content for semantic search.
      const embedText = `${article.title}\n${article.excerpt}\n${article.content}`
      const embedding = await generateEmbedding(embedText)
      await setArticleEmbedding(row.id, embedding)

      summary.created += 1
    } catch (err) {
      summary.errors.push(
        `${article.slug}: ${err instanceof Error ? err.message : String(err)}`
      )
    }
  }

  return NextResponse.json({
    success: true,
    message: `Seed complete: ${summary.created} created, ${summary.skipped} skipped, ${summary.errors.length} errors`,
    summary,
  })
}
