/**
 * Social Ingestion Service
 *
 * Orchestrates fetching social posts from all platform adapters,
 * de-duplicating, enriching with sentiment/engagement scores,
 * and persisting to the social_posts table.
 *
 * Called by:
 *  1. Cron API route (scheduled ingestion for all products)
 *  2. Manual "Refresh" button on the Social page
 *  3. Brand-submitted link endpoint
 */

import 'server-only'
import { db } from '@/db'
import { products, socialPosts } from '@/db/schema'
import { eq, inArray, sql } from 'drizzle-orm'
import {
  ALL_ADAPTERS,
  processBrandSubmittedLink,
  type SocialPostInput,
} from './platformAdapters'
import { insertSocialPosts, getSocialPostByExternalId } from '@/db/repositories/socialRepository'

// ============================================================================
// INGESTION FOR A SINGLE PRODUCT
// ============================================================================

export interface IngestionResult {
  productId: string
  fetched: number
  newPosts: number
  duplicatesSkipped: number
  errors: string[]
}

/**
 * Fetch social mentions for one product from all available adapters
 * and persist new posts to DB.
 */
export async function ingestSocialForProduct(
  productId: string,
  productName: string,
  options?: { platforms?: string[]; keywords?: string[] }
): Promise<IngestionResult> {
  const result: IngestionResult = {
    productId,
    fetched: 0,
    newPosts: 0,
    duplicatesSkipped: 0,
    errors: [],
  }

  // Build search keywords from product name + any custom keywords
  const keywords = options?.keywords ?? [productName]

  // Pick adapters
  const adapters = options?.platforms
    ? ALL_ADAPTERS.filter((a) => options.platforms!.includes(a.platform))
    : ALL_ADAPTERS

  // Fetch from all adapters in parallel
  const fetchResults = await Promise.allSettled(
    adapters.map((adapter) =>
      adapter.fetchMentions(keywords, productId).catch((err) => {
        result.errors.push(`${adapter.platform}: ${String(err)}`)
        return [] as SocialPostInput[]
      })
    )
  )

  const allPosts: SocialPostInput[] = []
  for (const r of fetchResults) {
    if (r.status === 'fulfilled') {
      allPosts.push(...r.value)
    } else {
      result.errors.push(String(r.reason))
    }
  }

  result.fetched = allPosts.length

  if (allPosts.length === 0) return result

  // De-duplicate against existing posts by externalId
  const newPosts: SocialPostInput[] = []
  const seenExternalIds = new Set<string>()

  for (const post of allPosts) {
    if (post.externalId) {
      if (seenExternalIds.has(post.externalId)) {
        result.duplicatesSkipped++
        continue
      }
      seenExternalIds.add(post.externalId)
    }
    newPosts.push(post)
  }

  // Insert (ON CONFLICT DO NOTHING handles any DB-level dedup)
  const dbRows = newPosts.map((p) => ({
    id: p.id,
    productId: p.productId,
    platform: p.platform,
    postType: p.postType || 'mention',
    content: p.content,
    title: p.title,
    url: p.url,
    author: p.author,
    authorHandle: p.authorHandle,
    authorAvatar: p.authorAvatar,
    authorFollowers: p.authorFollowers,
    isVerifiedAuthor: p.isVerifiedAuthor ?? false,
    likes: p.likes ?? 0,
    shares: p.shares ?? 0,
    comments: p.comments ?? 0,
    views: p.views,
    rating: p.rating,
    sentiment: p.sentiment,
    sentimentScore: p.sentimentScore,
    engagementScore: p.engagementScore,
    influenceScore: p.influenceScore,
    isKeyOpinionLeader: p.isKeyOpinionLeader ?? false,
    category: p.category,
    keywords: p.keywords ?? [],
    language: p.language,
    source: p.source,
    externalId: p.externalId,
    parentPostId: p.parentPostId,
    postedAt: p.postedAt,
  }))

  try {
    const inserted = await insertSocialPosts(dbRows)
    result.newPosts = inserted
    result.duplicatesSkipped += newPosts.length - inserted
  } catch (err) {
    result.errors.push(`DB insert: ${String(err)}`)
  }

  return result
}

// ============================================================================
// BATCH INGESTION FOR ALL BRAND PRODUCTS
// ============================================================================

export interface BatchIngestionResult {
  totalProducts: number
  totalFetched: number
  totalNewPosts: number
  perProduct: IngestionResult[]
}

/**
 * Ingest social mentions for all products owned by a brand.
 */
export async function ingestSocialForBrand(brandId: string): Promise<BatchIngestionResult> {
  const brandProducts = await db
    .select({ id: products.id, name: products.name })
    .from(products)
    .where(eq(products.ownerId, brandId))

  const batch: BatchIngestionResult = {
    totalProducts: brandProducts.length,
    totalFetched: 0,
    totalNewPosts: 0,
    perProduct: [],
  }

  // Process sequentially to avoid rate limits
  for (const product of brandProducts) {
    const result = await ingestSocialForProduct(product.id, product.name)
    batch.perProduct.push(result)
    batch.totalFetched += result.fetched
    batch.totalNewPosts += result.newPosts
  }

  return batch
}

/**
 * Ingest social mentions for ALL products that have socialListeningEnabled.
 * Called by cron.
 */
export async function ingestSocialForAllEnabled(): Promise<BatchIngestionResult> {
  const enabledProducts = await db
    .select({ id: products.id, name: products.name })
    .from(products)
    .where(eq(products.socialListeningEnabled, true))

  const batch: BatchIngestionResult = {
    totalProducts: enabledProducts.length,
    totalFetched: 0,
    totalNewPosts: 0,
    perProduct: [],
  }

  for (const product of enabledProducts) {
    const result = await ingestSocialForProduct(product.id, product.name)
    batch.perProduct.push(result)
    batch.totalFetched += result.fetched
    batch.totalNewPosts += result.newPosts
  }

  return batch
}

// ============================================================================
// BRAND-SUBMITTED LINK PROCESSING
// ============================================================================

export async function processSubmittedLink(
  url: string,
  productId: string,
  brandNotes?: string
): Promise<{ success: boolean; postId?: string; error?: string }> {
  try {
    const post = await processBrandSubmittedLink(url, productId, brandNotes)
    if (!post) return { success: false, error: 'Could not extract content from URL' }

    const dbRow = {
      id: post.id,
      productId: post.productId,
      platform: post.platform,
      postType: post.postType || 'mention',
      content: post.content,
      title: post.title,
      url: post.url,
      author: post.author,
      authorHandle: post.authorHandle,
      authorAvatar: post.authorAvatar,
      authorFollowers: post.authorFollowers,
      isVerifiedAuthor: post.isVerifiedAuthor ?? false,
      likes: post.likes ?? 0,
      shares: post.shares ?? 0,
      comments: post.comments ?? 0,
      views: post.views,
      rating: post.rating,
      sentiment: post.sentiment,
      sentimentScore: post.sentimentScore,
      engagementScore: post.engagementScore,
      influenceScore: post.influenceScore,
      isKeyOpinionLeader: post.isKeyOpinionLeader ?? false,
      category: post.category,
      keywords: post.keywords ?? [],
      language: post.language,
      source: post.source,
      externalId: post.externalId,
      parentPostId: post.parentPostId,
      postedAt: post.postedAt,
    }

    await insertSocialPosts([dbRow])
    return { success: true, postId: post.id }
  } catch (err) {
    return { success: false, error: String(err) }
  }
}
