import 'server-only'

/**
 * FAQ Service — knowledge-base read + search + ratings.
 *
 * Two search surfaces:
 *   1. listArticles + searchByKeyword (tsvector)
 *      → used by the public `/help` page; keyword search via PostgreSQL
 *        full-text index.
 *   2. searchBySemantic (pgvector cosine)
 *      → used by the chatbot in Phase 3; matches paraphrased questions
 *        ("how do I get money back" → "Refunds") via embedding similarity.
 *
 * Embedding regeneration is exposed for the admin FAQ edit flow
 * (Phase 7) — call regenerateEmbedding(slug) after the markdown content
 * changes so the chatbot stays in sync with the latest copy.
 */

import {
  listFaqArticles,
  findArticleBySlug,
  findArticleById,
  searchArticlesByKeyword,
  searchArticlesByEmbedding,
  incrementArticleView,
  rateArticle as repoRateArticle,
  setArticleEmbedding,
  createArticle,
  updateArticle,
  deleteArticle,
  logSupportEvent,
  type FaqListFilter,
} from '@/db/repositories/supportRepository'
import { generateEmbedding } from '@/lib/embeddings'
import type { FaqArticle, NewFaqArticle } from '@/db/schema'

// ════════════════════════════════════════════════════════════════
// READ — list + detail
// ════════════════════════════════════════════════════════════════

export type ListArticlesInput = {
  category?: FaqArticle['category']
  role?: string
  search?: string
  limit?: number
  offset?: number
}

/**
 * Public list endpoint. When `search` is provided, uses keyword tsvector
 * search; otherwise lists by display_order, then helpful_count.
 *
 * Always filters to `is_published = true` and role-appropriate articles.
 */
export async function listArticles(
  input: ListArticlesInput = {}
): Promise<FaqArticle[]> {
  const { category, role, search, limit = 20, offset = 0 } = input
  if (search && search.trim()) {
    return searchArticlesByKeyword(search.trim(), role, limit)
  }
  const filter: FaqListFilter = { role, publishedOnly: true }
  if (category) filter.category = category
  return listFaqArticles(filter, limit, offset)
}

/**
 * Detail endpoint. Increments view_count atomically and logs
 * `faq_viewed` analytics event. The caller may pass `userId` for
 * the analytics row (anonymous viewers pass `undefined`).
 */
export async function getArticleBySlug(
  slug: string,
  context: { userId?: string } = {}
): Promise<FaqArticle | null> {
  const article = await findArticleBySlug(slug)
  if (!article) return null
  if (article.isPublished) {
    void incrementArticleView(article.id).catch((e) =>
      console.error('[faq] view increment failed:', e)
    )
    await logSupportEvent({
      eventType: 'faq_viewed',
      userId: context.userId,
      data: { articleId: article.id, slug: article.slug, category: article.category },
    })
  }
  return article
}

// ════════════════════════════════════════════════════════════════
// RATE — helpful / not helpful
// ════════════════════════════════════════════════════════════════

export async function rateArticle(input: {
  articleId: string
  helpful: boolean
  userId?: string
}): Promise<void> {
  const article = await findArticleById(input.articleId)
  if (!article) throw new Error('Article not found')

  await repoRateArticle(input.articleId, input.helpful)

  await logSupportEvent({
    eventType: input.helpful ? 'faq_helpful' : 'faq_not_helpful',
    userId: input.userId,
    data: { articleId: article.id, slug: article.slug, category: article.category },
  })
}

// ════════════════════════════════════════════════════════════════
// SEARCH — keyword (tsvector) and semantic (pgvector)
// ════════════════════════════════════════════════════════════════

/**
 * Keyword search — used by `/help` page. Returns top matches ranked by
 * `ts_rank` then `helpful_count`.
 */
export async function searchByKeyword(
  query: string,
  options: { role?: string; limit?: number } = {}
): Promise<FaqArticle[]> {
  if (!query.trim()) return []
  return searchArticlesByKeyword(query.trim(), options.role, options.limit ?? 10)
}

/**
 * Semantic search — used by the chatbot. Embeds the query via OpenAI,
 * then ranks articles by cosine similarity. Articles below
 * `minSimilarity` are filtered out so we never return a poor match.
 *
 * Default `minSimilarity = 0.75` — the chatbot threshold for "good
 * enough to surface as an FAQ answer" (Q1 confirmed: pgvector for
 * chatbot, threshold tuned via Phase 3 testing).
 */
export async function searchBySemantic(
  query: string,
  options: { role?: string; limit?: number; minSimilarity?: number } = {}
): Promise<Array<FaqArticle & { similarity: number }>> {
  if (!query.trim()) return []
  const embedding = await generateEmbedding(query.trim())
  return searchArticlesByEmbedding(embedding, {
    role: options.role,
    limit: options.limit ?? 5,
    minSimilarity: options.minSimilarity ?? 0.75,
  })
}

// ════════════════════════════════════════════════════════════════
// ADMIN — create / update / delete
// ════════════════════════════════════════════════════════════════

/**
 * Create an article and generate its embedding in one shot. The
 * `search_vector` is populated by the DB trigger; the embedding is
 * generated here and persisted via setArticleEmbedding.
 *
 * Caller (admin route) must verify the slug is unique before calling.
 */
export async function createArticleWithEmbedding(
  data: Omit<NewFaqArticle, 'id' | 'createdAt' | 'updatedAt'>
): Promise<FaqArticle> {
  const row = await createArticle(data)
  await regenerateEmbeddingForArticle(row)
  return row
}

/**
 * Update an article and (if the title/excerpt/content changed) regenerate
 * its embedding. Trigger handles the tsvector resync automatically.
 */
export async function updateArticleWithEmbedding(
  id: string,
  data: Partial<Omit<NewFaqArticle, 'id' | 'createdAt'>>
): Promise<FaqArticle> {
  const before = await findArticleById(id)
  if (!before) throw new Error('Article not found')
  const updated = await updateArticle(id, data)
  // Only regenerate if any embed-impacting field changed.
  const changed =
    (data.title !== undefined && data.title !== before.title) ||
    (data.excerpt !== undefined && data.excerpt !== before.excerpt) ||
    (data.content !== undefined && data.content !== before.content)
  if (changed) await regenerateEmbeddingForArticle(updated)
  return updated
}

export async function deleteArticleById(id: string): Promise<void> {
  await deleteArticle(id)
}

/** Used by seed route and admin re-embed action. */
export async function regenerateEmbeddingForArticle(article: FaqArticle): Promise<void> {
  const text = `${article.title}\n${article.excerpt}\n${article.content}`
  const embedding = await generateEmbedding(text)
  await setArticleEmbedding(article.id, embedding)
}
