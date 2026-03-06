import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { feedback, feedbackMedia, socialPosts } from '@/db/schema'
import { analyzeSentiment } from '@/server/sentimentService'

/**
 * Webhook v2 — Unified import for reviews, social, support & multimodal feedback.
 *
 * ---
 * Supported source types:
 *
 * SUPPORT / HELPDESK          REVIEWS              SOCIAL              CUSTOM
 * ─────────────────           ───────              ──────              ──────
 * zendesk                     google_reviews       reddit              custom
 * intercom                    trustpilot           youtube
 * freshdesk                   g2                   twitter
 * hubspot                     capterra             linkedin
 *                             app_store
 *                             play_store
 *
 * ---
 * Key improvements over v1:
 *
 * 1. Source taxonomy — validated source + sourceType
 * 2. External identity — externalId for deduplication
 * 3. Metadata — arbitrary key/value for source-specific fields
 * 4. Social posts — reddit/youtube/twitter → `social_posts` table
 * 5. Media attachments — optional `media[]` for audio/video/image URLs
 * 6. Timestamp preservation — `createdAt` from source
 * 7. URL traceability — link back to original review/ticket/post
 * 8. Engagement metrics — upvotes, likes, shares for social
 * 9. Batch up to 200 entries per call
 *
 * Auth: X-API-Key header or apiKey in body (same env var).
 */

// ── Source registry ───────────────────────────────────────────────

const SOURCE_TYPES = {
  // Support / Helpdesk
  zendesk: 'support',
  intercom: 'support',
  freshdesk: 'support',
  hubspot: 'support',

  // Review platforms
  google_reviews: 'review',
  trustpilot: 'review',
  g2: 'review',
  capterra: 'review',
  app_store: 'review',
  play_store: 'review',

  // Social platforms
  reddit: 'social',
  youtube: 'social',
  twitter: 'social',
  linkedin: 'social',

  // Catch-all
  custom: 'custom',
} as const

type SourceKey = keyof typeof SOURCE_TYPES
type SourceType = (typeof SOURCE_TYPES)[SourceKey]

const VALID_SOURCES = new Set(Object.keys(SOURCE_TYPES))

// ── Media types ───────────────────────────────────────────────────

const VALID_MEDIA_TYPES = new Set(['audio', 'video', 'image'])

// ── Auth ──────────────────────────────────────────────────────────

const VALID_API_KEY = process.env.IMPORT_WEBHOOK_API_KEY || 'webhook_secret_key'

// ── Types ─────────────────────────────────────────────────────────

type MediaAttachment = {
  type: 'audio' | 'video' | 'image'
  url: string
  mimeType?: string
  durationMs?: number
  sizeBytes?: number
}

type WebhookEntry = {
  productId: string
  text: string
  rating?: number         // 1-5 (normalized from any scale)
  author?: string
  email?: string
  category?: string
  externalId?: string     // Source-native ID for dedup
  sourceUrl?: string      // URL to original review/ticket/post
  createdAt?: string      // ISO timestamp from source
  media?: MediaAttachment[]
  metadata?: Record<string, any> // Source-specific fields
  // Social-specific
  engagement?: {
    upvotes?: number
    downvotes?: number
    likes?: number
    shares?: number
    comments?: number
    score?: number
  }
}

type WebhookV2Body = {
  apiKey?: string
  source: string
  entries: WebhookEntry[]
}

// ── Helpers ───────────────────────────────────────────────────────

function clampRating(val: unknown): number | null {
  if (typeof val !== 'number' || isNaN(val)) return null
  return Math.min(5, Math.max(1, Math.round(val)))
}

function safeDate(iso: unknown): Date | null {
  if (typeof iso !== 'string') return null
  const d = new Date(iso)
  return isNaN(d.getTime()) ? null : d
}

function computeEngagementScore(eng?: WebhookEntry['engagement']): number | null {
  if (!eng) return null
  // Simple composite: likes + upvotes + shares*2 + comments*1.5
  const likes = eng.likes ?? eng.upvotes ?? 0
  const shares = eng.shares ?? 0
  const comments = eng.comments ?? 0
  const downvotes = eng.downvotes ?? 0
  return Math.max(0, likes - downvotes + shares * 2 + comments * 1.5)
}

// ── Route handler ─────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    // ── Auth ────────────────────────────────────────────
    const headerKey = request.headers.get('X-API-Key')
    const body: WebhookV2Body = await request.json()
    const apiKey = headerKey || body.apiKey

    if (!apiKey || apiKey !== VALID_API_KEY) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })
    }

    // ── Validate source ─────────────────────────────────
    const source = body.source?.toLowerCase().trim()
    if (!source || !VALID_SOURCES.has(source)) {
      return NextResponse.json(
        {
          error: `Invalid source "${body.source}". Supported: ${[...VALID_SOURCES].join(', ')}`,
        },
        { status: 400 }
      )
    }

    const sourceType: SourceType = SOURCE_TYPES[source as SourceKey]

    // ── Validate entries ────────────────────────────────
    const { entries } = body
    if (!Array.isArray(entries) || entries.length === 0) {
      return NextResponse.json(
        { error: '"entries" array is required and must not be empty' },
        { status: 400 }
      )
    }

    if (entries.length > 200) {
      return NextResponse.json(
        { error: 'Maximum 200 entries per webhook call' },
        { status: 400 }
      )
    }

    // ── Process entries ─────────────────────────────────
    let imported = 0
    let skipped = 0
    let mediaLinked = 0
    let socialInserted = 0
    const errors: string[] = []
    const dedupeSet = new Set<string>() // externalId dedup within batch

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i]
      try {
        const productId = entry.productId?.trim()
        const text = entry.text?.trim()

        if (!productId || !text || text.length < 5) {
          skipped++
          continue
        }

        // Dedup within batch by externalId
        if (entry.externalId) {
          const dedupeKey = `${source}:${entry.externalId}`
          if (dedupeSet.has(dedupeKey)) {
            skipped++
            continue
          }
          dedupeSet.add(dedupeKey)
        }

        // Detect modality
        const hasMedia = Array.isArray(entry.media) && entry.media.length > 0
        const mediaTypes = new Set(entry.media?.map(m => m.type).filter(t => VALID_MEDIA_TYPES.has(t)) || [])
        const modalityPrimary = !hasMedia
          ? 'text'
          : mediaTypes.size > 1
            ? 'mixed'
            : mediaTypes.has('audio')
              ? 'audio'
              : mediaTypes.has('video')
                ? 'video'
                : 'text'

        // Run sentiment
        const sentimentResult = await analyzeSentiment(text)

        // Parse timestamp
        const sourceDate = safeDate(entry.createdAt)

        // ── Insert into feedback table ──────────────────
        const feedbackId = crypto.randomUUID()

        await db.insert(feedback).values({
          id: feedbackId,
          productId,
          feedbackText: text,
          rating: clampRating(entry.rating),
          userName: entry.author || `${source} Import`,
          userEmail: entry.email || null,
          sentiment: sentimentResult.sentiment,
          category: entry.category || source,
          status: 'approved',
          modalityPrimary,
          processingStatus: hasMedia ? 'processing' : 'ready',
          multimodalMetadata: {
            importSource: source,
            sourceType,
            externalId: entry.externalId || null,
            sourceUrl: entry.sourceUrl || null,
            importedAt: new Date().toISOString(),
            engagement: entry.engagement || null,
            metadata: entry.metadata || null,
          },
          ...(sourceDate ? { createdAt: sourceDate } : {}),
        })

        // ── Insert media attachments (if any) ───────────
        if (hasMedia && entry.media) {
          for (const m of entry.media) {
            if (!m.url || !VALID_MEDIA_TYPES.has(m.type)) continue

            await db.insert(feedbackMedia).values({
              ownerType: 'feedback',
              ownerId: feedbackId,
              mediaType: m.type,
              storageProvider: 'external_url',
              storageKey: m.url,
              mimeType: m.mimeType || null,
              sizeBytes: m.sizeBytes || null,
              durationMs: m.durationMs || null,
              status: m.type === 'image' ? 'ready' : 'uploaded', // images don't need transcription
            })
            mediaLinked++
          }
        }

        // ── Also insert into social_posts for social sources ──
        if (sourceType === 'social') {
          const engScore = computeEngagementScore(entry.engagement)

          await db.insert(socialPosts).values({
            id: entry.externalId || `${source}_${feedbackId}`,
            productId,
            platform: source,
            content: text,
            url: entry.sourceUrl || null,
            author: entry.author || null,
            sentiment: sentimentResult.sentiment,
            engagementScore: engScore,
            ...(sourceDate ? { createdAt: sourceDate } : {}),
          })
          socialInserted++
        }

        imported++
      } catch (err) {
        skipped++
        errors.push(`Entry ${i}: ${err instanceof Error ? err.message : 'Unknown error'}`)
      }
    }

    return NextResponse.json({
      success: true,
      version: 'v2',
      source,
      sourceType,
      imported,
      skipped,
      mediaLinked,
      socialInserted,
      total: entries.length,
      errors: errors.slice(0, 10),
    })
  } catch (error) {
    console.error('[Webhook v2] Error:', error)
    return NextResponse.json({ error: 'Failed to process webhook' }, { status: 500 })
  }
}
