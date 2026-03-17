/**
 * Platform Adapters for Social Listening
 *
 * Each adapter implements the same interface so the ingestion service
 * can treat all platforms uniformly.
 *
 * Current strategy: Server-side fetch with structured parsing.
 * - For platforms with public APIs (Reddit, Google Places, etc.) we use those.
 * - For platforms that require scraping (Twitter/X, Instagram, TikTok)
 *   we define the adapter shape so a real scraping proxy or third-party
 *   service (e.g., Apify, Bright Data) can be swapped in via env vars.
 * - Brand-submitted links are handled by a dedicated adapter.
 *
 * Each adapter returns a normalised SocialPostInput array that maps
 * directly to the socialPosts table columns.
 */

import 'server-only'
import { analyzeSentiment } from '@/server/sentimentService'
import { randomUUID } from 'crypto'

// ============================================================================
// SHARED TYPES
// ============================================================================

export type SocialPostInput = {
  id: string
  productId: string
  platform: string
  postType: string
  content: string
  title?: string
  url?: string
  author?: string
  authorHandle?: string
  authorAvatar?: string
  authorFollowers?: number
  isVerifiedAuthor?: boolean
  likes?: number
  shares?: number
  comments?: number
  views?: number
  rating?: number
  sentiment?: string
  sentimentScore?: number
  engagementScore?: number
  influenceScore?: number
  isKeyOpinionLeader?: boolean
  category?: string
  keywords?: string[]
  language?: string
  source: 'scraper' | 'api' | 'brand_submitted' | 'webhook'
  externalId?: string
  parentPostId?: string
  postedAt?: Date
}

export interface PlatformAdapter {
  platform: string
  /**
   * Fetch posts mentioning a product/brand keyword from this platform.
   * @param keywords  search terms (brand name, product name, etc.)
   * @param productId the product these posts relate to
   * @param options   platform-specific options (API keys, limits, etc.)
   */
  fetchMentions(
    keywords: string[],
    productId: string,
    options?: Record<string, any>
  ): Promise<SocialPostInput[]>
}

// ============================================================================
// HELPERS
// ============================================================================

function genId(platform: string): string {
  return `sp_${platform}_${randomUUID().replace(/-/g, '').slice(0, 12)}`
}

async function enrichSentiment(
  posts: SocialPostInput[]
): Promise<SocialPostInput[]> {
  const enriched = await Promise.all(
    posts.map(async (post) => {
      if (post.sentiment && post.sentimentScore !== undefined) return post
      const analysis = await analyzeSentiment(post.content)
      return {
        ...post,
        sentiment: analysis.sentiment,
        sentimentScore: analysis.score,
      }
    })
  )
  return enriched
}

function calculateEngagement(likes = 0, shares = 0, comments = 0, views = 0): number {
  // Normalised 0–1 engagement score
  const raw = likes * 1 + shares * 2 + comments * 3 + (views > 0 ? (likes + shares + comments) / views : 0) * 100
  return Math.min(raw / 1000, 1)
}

function calculateInfluence(followers = 0, isVerified = false): number {
  const base = Math.min(Math.log10(Math.max(followers, 1)) / 7, 1) // log10(10M)=7 → 1.0
  return isVerified ? Math.min(base + 0.15, 1) : base
}

function classifyPost(content: string): string {
  const lower = content.toLowerCase()
  if (/bug|crash|broken|error|issue|problem|not work/i.test(lower)) return 'complaint'
  if (/love|amazing|great|best|awesome|excellent|recommend/i.test(lower)) return 'praise'
  if (/feature|wish|want|need|should|please add/i.test(lower)) return 'feature_request'
  if (/vs |versus|compared to|better than|switch from/i.test(lower)) return 'comparison'
  if (/help|support|how do|how to|can't|unable/i.test(lower)) return 'customer_support'
  return 'brand_mention'
}

function extractKeywords(content: string): string[] {
  const stopWords = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'shall', 'can', 'need', 'dare', 'ought',
    'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from',
    'it', 'its', 'this', 'that', 'i', 'my', 'me', 'we', 'you', 'your',
    'he', 'she', 'they', 'them', 'not', 'no', 'so', 'but', 'and', 'or',
    'if', 'then', 'than', 'too', 'very', 'just', 'about', 'up', 'out',
    'all', 'also', 'as', 'any', 'each', 'more', 'some', 'such', 'only',
  ])
  const words = content
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w))

  const freq: Record<string, number> = {}
  for (const w of words) freq[w] = (freq[w] || 0) + 1
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([k]) => k)
}

// ============================================================================
// REDDIT ADAPTER  (uses public JSON endpoints — no API key needed)
// ============================================================================

export class RedditAdapter implements PlatformAdapter {
  platform = 'reddit'

  async fetchMentions(
    keywords: string[],
    productId: string,
  ): Promise<SocialPostInput[]> {
    const posts: SocialPostInput[] = []
    const query = keywords.join(' OR ')

    try {
      const url = `https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&sort=new&limit=25&t=week`
      const res = await fetch(url, {
        headers: { 'User-Agent': 'earn4insights/1.0 (social-listening)' },
        next: { revalidate: 3600 },
      })

      if (!res.ok) return posts

      const data = await res.json()
      const children = data?.data?.children ?? []

      for (const child of children) {
        const d = child.data
        if (!d || d.is_self === false && !d.selftext) continue

        const content = d.selftext || d.title || ''
        const engagement = calculateEngagement(d.ups || 0, 0, d.num_comments || 0)
        const influence = calculateInfluence(d.author_karma || 0)

        posts.push({
          id: genId('reddit'),
          productId,
          platform: 'reddit',
          postType: d.num_comments > 20 ? 'discussion' : 'mention',
          content: content.slice(0, 2000),
          title: d.title,
          url: `https://www.reddit.com${d.permalink}`,
          author: d.author,
          authorHandle: `u/${d.author}`,
          likes: d.ups || 0,
          shares: 0,
          comments: d.num_comments || 0,
          engagementScore: engagement,
          influenceScore: influence,
          isKeyOpinionLeader: influence > 0.6,
          category: classifyPost(content),
          keywords: extractKeywords(content),
          language: 'en',
          source: 'api',
          externalId: d.id,
          postedAt: new Date(d.created_utc * 1000),
        })
      }
    } catch (err) {
      console.error('[RedditAdapter] fetch error:', err)
    }

    return enrichSentiment(posts)
  }
}

// ============================================================================
// GOOGLE REVIEWS ADAPTER
// Uses Google Places API if GOOGLE_PLACES_API_KEY is set;
// otherwise returns empty (brands can use brand-submitted flow).
// ============================================================================

export class GoogleReviewsAdapter implements PlatformAdapter {
  platform = 'google'

  async fetchMentions(
    keywords: string[],
    productId: string,
    options?: { placeId?: string }
  ): Promise<SocialPostInput[]> {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY
    if (!apiKey) return []

    const placeId = options?.placeId
    if (!placeId) return []

    const posts: SocialPostInput[] = []

    try {
      const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=reviews&key=${apiKey}`
      const res = await fetch(url, { next: { revalidate: 86400 } })
      if (!res.ok) return posts

      const data = await res.json()
      const reviews = data?.result?.reviews ?? []

      for (const review of reviews) {
        const content = review.text || ''
        if (!content) continue

        posts.push({
          id: genId('google'),
          productId,
          platform: 'google',
          postType: 'review',
          content: content.slice(0, 2000),
          url: review.author_url,
          author: review.author_name,
          authorAvatar: review.profile_photo_url,
          rating: review.rating,
          likes: 0,
          shares: 0,
          comments: 0,
          engagementScore: 0,
          influenceScore: 0,
          category: classifyPost(content),
          keywords: extractKeywords(content),
          language: review.language || 'en',
          source: 'api',
          externalId: `goog_${review.time}`,
          postedAt: new Date(review.time * 1000),
        })
      }
    } catch (err) {
      console.error('[GoogleReviewsAdapter] fetch error:', err)
    }

    return enrichSentiment(posts)
  }
}

// ============================================================================
// TWITTER / X ADAPTER
// Uses Twitter API v2 if TWITTER_BEARER_TOKEN is set.
// ============================================================================

export class TwitterAdapter implements PlatformAdapter {
  platform = 'twitter'

  async fetchMentions(
    keywords: string[],
    productId: string,
  ): Promise<SocialPostInput[]> {
    const bearer = process.env.TWITTER_BEARER_TOKEN
    if (!bearer) return []

    const posts: SocialPostInput[] = []
    const query = keywords.map((k) => `"${k}"`).join(' OR ')

    try {
      const searchUrl = `https://api.twitter.com/2/tweets/search/recent?query=${encodeURIComponent(query)}&max_results=25&tweet.fields=created_at,public_metrics,author_id,lang&expansions=author_id&user.fields=name,username,profile_image_url,public_metrics,verified`

      const res = await fetch(searchUrl, {
        headers: { Authorization: `Bearer ${bearer}` },
        next: { revalidate: 900 },
      })
      if (!res.ok) return posts

      const data = await res.json()
      const tweets = data?.data ?? []
      const users = (data?.includes?.users ?? []).reduce(
        (map: Record<string, any>, u: any) => {
          map[u.id] = u
          return map
        },
        {} as Record<string, any>
      )

      for (const tweet of tweets) {
        const user = users[tweet.author_id] || {}
        const pm = tweet.public_metrics || {}
        const followers = user.public_metrics?.followers_count || 0
        const influence = calculateInfluence(followers, user.verified)

        posts.push({
          id: genId('twitter'),
          productId,
          platform: 'twitter',
          postType: 'mention',
          content: tweet.text?.slice(0, 2000) || '',
          url: `https://twitter.com/${user.username || '_'}/status/${tweet.id}`,
          author: user.name,
          authorHandle: `@${user.username || ''}`,
          authorAvatar: user.profile_image_url,
          authorFollowers: followers,
          isVerifiedAuthor: !!user.verified,
          likes: pm.like_count || 0,
          shares: pm.retweet_count || 0,
          comments: pm.reply_count || 0,
          views: pm.impression_count || 0,
          engagementScore: calculateEngagement(pm.like_count, pm.retweet_count, pm.reply_count, pm.impression_count),
          influenceScore: influence,
          isKeyOpinionLeader: influence > 0.5,
          category: classifyPost(tweet.text || ''),
          keywords: extractKeywords(tweet.text || ''),
          language: tweet.lang || 'en',
          source: 'api',
          externalId: tweet.id,
          postedAt: tweet.created_at ? new Date(tweet.created_at) : undefined,
        })
      }
    } catch (err) {
      console.error('[TwitterAdapter] fetch error:', err)
    }

    return enrichSentiment(posts)
  }
}

// ============================================================================
// AMAZON / FLIPKART ADAPTER
// Review scraping placeholder — real implementation would use a proxy
// service like ScrapingBee, Bright Data, or Apify.
// When AMAZON_SCRAPER_URL / FLIPKART_SCRAPER_URL env vars are set
// we call those endpoints; otherwise returns empty.
// ============================================================================

export class AmazonReviewsAdapter implements PlatformAdapter {
  platform = 'amazon'

  async fetchMentions(
    keywords: string[],
    productId: string,
    options?: { asin?: string }
  ): Promise<SocialPostInput[]> {
    const scraperUrl = process.env.AMAZON_SCRAPER_URL
    if (!scraperUrl || !options?.asin) return []

    const posts: SocialPostInput[] = []

    try {
      const res = await fetch(`${scraperUrl}?asin=${encodeURIComponent(options.asin)}&limit=25`, {
        next: { revalidate: 86400 },
      })
      if (!res.ok) return posts

      const reviews: any[] = await res.json()

      for (const review of reviews) {
        const content = review.text || review.body || ''
        if (!content) continue

        posts.push({
          id: genId('amazon'),
          productId,
          platform: 'amazon',
          postType: 'review',
          content: content.slice(0, 2000),
          title: review.title,
          url: review.url,
          author: review.author || 'Amazon Customer',
          rating: review.rating,
          likes: review.helpful_count || 0,
          shares: 0,
          comments: 0,
          engagementScore: calculateEngagement(review.helpful_count || 0, 0, 0),
          influenceScore: 0,
          category: classifyPost(content),
          keywords: extractKeywords(content),
          language: review.language || 'en',
          source: 'scraper',
          externalId: review.id || review.review_id,
          postedAt: review.date ? new Date(review.date) : undefined,
        })
      }
    } catch (err) {
      console.error('[AmazonReviewsAdapter] fetch error:', err)
    }

    return enrichSentiment(posts)
  }
}

export class FlipkartReviewsAdapter implements PlatformAdapter {
  platform = 'flipkart'

  async fetchMentions(
    keywords: string[],
    productId: string,
    options?: { flipkartProductId?: string }
  ): Promise<SocialPostInput[]> {
    const scraperUrl = process.env.FLIPKART_SCRAPER_URL
    if (!scraperUrl || !options?.flipkartProductId) return []

    const posts: SocialPostInput[] = []

    try {
      const res = await fetch(
        `${scraperUrl}?product_id=${encodeURIComponent(options.flipkartProductId)}&limit=25`,
        { next: { revalidate: 86400 } }
      )
      if (!res.ok) return posts

      const reviews: any[] = await res.json()

      for (const review of reviews) {
        const content = review.text || review.body || ''
        if (!content) continue

        posts.push({
          id: genId('flipkart'),
          productId,
          platform: 'flipkart',
          postType: 'review',
          content: content.slice(0, 2000),
          title: review.title,
          url: review.url,
          author: review.author || 'Flipkart User',
          rating: review.rating,
          likes: review.helpful_count || 0,
          shares: 0,
          comments: 0,
          engagementScore: calculateEngagement(review.helpful_count || 0, 0, 0),
          influenceScore: 0,
          category: classifyPost(content),
          keywords: extractKeywords(content),
          language: review.language || 'en',
          source: 'scraper',
          externalId: review.id || review.review_id,
          postedAt: review.date ? new Date(review.date) : undefined,
        })
      }
    } catch (err) {
      console.error('[FlipkartReviewsAdapter] fetch error:', err)
    }

    return enrichSentiment(posts)
  }
}

// ============================================================================
// INSTAGRAM / TIKTOK / META / YOUTUBE / LINKEDIN ADAPTERS
// These require OAuth or partner APIs. We define the adapter shape here
// so they can be plugged in when API access is available.
// ============================================================================

export class InstagramAdapter implements PlatformAdapter {
  platform = 'instagram'

  async fetchMentions(
    keywords: string[],
    productId: string,
  ): Promise<SocialPostInput[]> {
    // Instagram Basic Display / Graph API requires app review + business account
    // Env: INSTAGRAM_ACCESS_TOKEN
    const token = process.env.INSTAGRAM_ACCESS_TOKEN
    if (!token) return []

    // When token is available, search hashtags / mentions
    // Placeholder — real implementation would use Graph API
    return []
  }
}

export class TikTokAdapter implements PlatformAdapter {
  platform = 'tiktok'

  async fetchMentions(
    keywords: string[],
    productId: string,
  ): Promise<SocialPostInput[]> {
    // TikTok Research API requires approved access
    // Env: TIKTOK_API_KEY
    const apiKey = process.env.TIKTOK_API_KEY
    if (!apiKey) return []
    return []
  }
}

export class YouTubeAdapter implements PlatformAdapter {
  platform = 'youtube'

  async fetchMentions(
    keywords: string[],
    productId: string,
  ): Promise<SocialPostInput[]> {
    const apiKey = process.env.YOUTUBE_API_KEY
    if (!apiKey) return []

    const posts: SocialPostInput[] = []
    const query = keywords.join(' ')

    try {
      const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&order=date&maxResults=15&key=${apiKey}`
      const res = await fetch(searchUrl, { next: { revalidate: 3600 } })
      if (!res.ok) return posts

      const data = await res.json()
      const items = data?.items ?? []

      for (const item of items) {
        const snippet = item.snippet
        const content = snippet?.description || snippet?.title || ''

        posts.push({
          id: genId('youtube'),
          productId,
          platform: 'youtube',
          postType: 'mention',
          content: content.slice(0, 2000),
          title: snippet?.title,
          url: `https://www.youtube.com/watch?v=${item.id?.videoId}`,
          author: snippet?.channelTitle,
          authorHandle: snippet?.channelId,
          authorAvatar: snippet?.thumbnails?.default?.url,
          likes: 0,
          shares: 0,
          comments: 0,
          engagementScore: 0,
          influenceScore: 0,
          category: classifyPost(content),
          keywords: extractKeywords(content),
          language: 'en',
          source: 'api',
          externalId: item.id?.videoId,
          postedAt: snippet?.publishedAt ? new Date(snippet.publishedAt) : undefined,
        })
      }
    } catch (err) {
      console.error('[YouTubeAdapter] fetch error:', err)
    }

    return enrichSentiment(posts)
  }
}

export class LinkedInAdapter implements PlatformAdapter {
  platform = 'linkedin'

  async fetchMentions(
    keywords: string[],
    productId: string,
  ): Promise<SocialPostInput[]> {
    // LinkedIn API requires OAuth 2.0 + partner access
    // Env: LINKEDIN_ACCESS_TOKEN
    const token = process.env.LINKEDIN_ACCESS_TOKEN
    if (!token) return []
    return []
  }
}

export class MetaAdapter implements PlatformAdapter {
  platform = 'meta'

  async fetchMentions(
    keywords: string[],
    productId: string,
  ): Promise<SocialPostInput[]> {
    // Meta/Facebook Graph API requires app review
    // Env: META_ACCESS_TOKEN
    const token = process.env.META_ACCESS_TOKEN
    if (!token) return []
    return []
  }
}

// ============================================================================
// BRAND-SUBMITTED LINK ADAPTER
// Brands paste a URL; we fetch the page, extract text, and create a post.
// ============================================================================

export class BrandSubmittedAdapter implements PlatformAdapter {
  platform = 'brand_submitted'

  async fetchMentions(): Promise<SocialPostInput[]> {
    // Not used via fetchMentions — see processBrandSubmittedLink below
    return []
  }
}

export async function processBrandSubmittedLink(
  url: string,
  productId: string,
  brandNotes?: string
): Promise<SocialPostInput | null> {
  // Detect platform from URL
  const platform = detectPlatformFromUrl(url)

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'earn4insights/1.0' },
      redirect: 'follow',
    })
    if (!res.ok) return null

    const html = await res.text()

    // Simple text extraction — strip tags
    const textContent = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 2000)

    if (!textContent || textContent.length < 10) return null

    const analysis = await analyzeSentiment(textContent)

    return {
      id: genId(platform),
      productId,
      platform,
      postType: 'mention',
      content: brandNotes ? `${brandNotes}\n\n---\n\n${textContent}` : textContent,
      url,
      category: classifyPost(textContent),
      keywords: extractKeywords(textContent),
      sentiment: analysis.sentiment,
      sentimentScore: analysis.score,
      engagementScore: 0,
      influenceScore: 0,
      source: 'brand_submitted',
      externalId: url,
      postedAt: new Date(),
    }
  } catch (err) {
    console.error('[BrandSubmittedAdapter] fetch error:', err)
    return null
  }
}

function detectPlatformFromUrl(url: string): string {
  const lower = url.toLowerCase()
  if (lower.includes('twitter.com') || lower.includes('x.com')) return 'twitter'
  if (lower.includes('instagram.com')) return 'instagram'
  if (lower.includes('tiktok.com')) return 'tiktok'
  if (lower.includes('facebook.com') || lower.includes('fb.com')) return 'meta'
  if (lower.includes('reddit.com')) return 'reddit'
  if (lower.includes('youtube.com') || lower.includes('youtu.be')) return 'youtube'
  if (lower.includes('linkedin.com')) return 'linkedin'
  if (lower.includes('amazon.')) return 'amazon'
  if (lower.includes('flipkart.')) return 'flipkart'
  if (lower.includes('google.com/maps') || lower.includes('goo.gl/maps')) return 'google'
  return 'other'
}

// ============================================================================
// ADAPTER REGISTRY
// ============================================================================

export const ALL_ADAPTERS: PlatformAdapter[] = [
  new RedditAdapter(),
  new TwitterAdapter(),
  new GoogleReviewsAdapter(),
  new AmazonReviewsAdapter(),
  new FlipkartReviewsAdapter(),
  new InstagramAdapter(),
  new TikTokAdapter(),
  new YouTubeAdapter(),
  new LinkedInAdapter(),
  new MetaAdapter(),
]

export function getAdapterForPlatform(platform: string): PlatformAdapter | undefined {
  return ALL_ADAPTERS.find((a) => a.platform === platform)
}
