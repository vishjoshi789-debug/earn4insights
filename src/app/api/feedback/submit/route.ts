import { NextResponse } from 'next/server'
import { db } from '@/db'
import { feedback } from '@/db/schema'
import { analyzeSentiment } from '@/server/sentimentService'
import { normalizeTextForAnalytics } from '@/server/textNormalizationService'
import { auth } from '@/lib/auth/auth.config'
import { eq, and, gte, sql, desc } from 'drizzle-orm'

// ── Anti-fraud constants ──────────────────────────────────────
const MAX_TEXT_LENGTH = 5000
const MIN_TEXT_LENGTH = 20
const MAX_SUBMISSIONS_PER_HOUR = 5
const DUPLICATE_COOLDOWN_HOURS = 24
const MIN_UNIQUE_CHARS_RATIO = 0.15 // at least 15% unique characters
const MIN_WORD_COUNT = 3

/**
 * Check if text looks like gibberish / low-effort spam
 * Returns a reason string if flagged, or null if ok
 */
function detectLowQuality(text: string): string | null {
  const trimmed = text.trim()

  // Too short
  if (trimmed.length < MIN_TEXT_LENGTH) {
    return `Feedback must be at least ${MIN_TEXT_LENGTH} characters for meaningful analysis.`
  }

  // Too long
  if (trimmed.length > MAX_TEXT_LENGTH) {
    return `Feedback cannot exceed ${MAX_TEXT_LENGTH} characters.`
  }

  // Repeated characters (e.g. "aaaaaaaaaa" or "hahahahaha")
  const uniqueChars = new Set(trimmed.toLowerCase().replace(/\s/g, ''))
  const ratio = uniqueChars.size / trimmed.replace(/\s/g, '').length
  if (ratio < MIN_UNIQUE_CHARS_RATIO && trimmed.length > 30) {
    return 'Your feedback appears to contain repetitive characters. Please provide genuine feedback.'
  }

  // Too few words
  const words = trimmed.split(/\s+/).filter(w => w.length > 0)
  if (words.length < MIN_WORD_COUNT) {
    return `Please write at least ${MIN_WORD_COUNT} words for a useful review.`
  }

  // Repeated word spam (same word repeated >60% of the time)
  const wordCounts: Record<string, number> = {}
  for (const w of words) {
    const lower = w.toLowerCase()
    wordCounts[lower] = (wordCounts[lower] || 0) + 1
  }
  const maxWordFreq = Math.max(...Object.values(wordCounts))
  if (words.length >= 5 && maxWordFreq / words.length > 0.6) {
    return 'Your feedback appears to repeat the same word. Please share genuine thoughts.'
  }

  return null
}

/**
 * POST /api/feedback/submit
 * 
 * Submit direct feedback for a product.
 * 
 * Anti-fraud checks:
 * 1. Authentication required (session)
 * 2. Rate limiting: max 5 per hour per user
 * 3. Duplicate detection: same product within 24h
 * 4. Text similarity check: reject near-identical resubmissions
 * 5. Content quality: min length, word count, gibberish detection
 * 6. Text max length cap
 * 
 * Body: {
 *   productId: string (required)
 *   feedbackText: string (required, min 20 chars)
 *   rating?: number (1-5)
 *   category?: 'general' | 'bug' | 'feature-request' | 'praise' | 'complaint'
 *   userName?: string
 *   userEmail?: string
 * }
 */
export async function POST(request: Request) {
  try {
    // ── 1. Auth check ──────────────────────────────────────────
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'You must be logged in to submit feedback.' },
        { status: 401 }
      )
    }
    const userEmail = session.user.email
    const userName = session.user.name || null

    const body = await request.json()
    const {
      productId,
      feedbackText,
      rating,
      category,
    } = body

    // ── 2. Basic validation ────────────────────────────────────
    if (!productId || typeof productId !== 'string') {
      return NextResponse.json(
        { error: 'productId is required' },
        { status: 400 }
      )
    }

    if (!feedbackText || typeof feedbackText !== 'string') {
      return NextResponse.json(
        { error: 'feedbackText is required' },
        { status: 400 }
      )
    }

    if (rating !== undefined && (typeof rating !== 'number' || rating < 1 || rating > 5)) {
      return NextResponse.json(
        { error: 'rating must be between 1 and 5' },
        { status: 400 }
      )
    }

    const validCategories = ['general', 'bug', 'feature-request', 'praise', 'complaint']
    if (category && !validCategories.includes(category)) {
      return NextResponse.json(
        { error: `category must be one of: ${validCategories.join(', ')}` },
        { status: 400 }
      )
    }

    const trimmedText = feedbackText.trim()

    // ── 3. Content quality checks ──────────────────────────────
    const qualityIssue = detectLowQuality(trimmedText)
    if (qualityIssue) {
      return NextResponse.json(
        { error: qualityIssue },
        { status: 422 }
      )
    }

    // ── 4. Rate limiting (max 5/hour per user) ─────────────────
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
    const [rateCheck] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(feedback)
      .where(
        and(
          eq(feedback.userEmail, userEmail),
          gte(feedback.createdAt, oneHourAgo)
        )
      )

    if (rateCheck && rateCheck.count >= MAX_SUBMISSIONS_PER_HOUR) {
      return NextResponse.json(
        { error: `You've submitted ${MAX_SUBMISSIONS_PER_HOUR} feedback entries this hour. Please wait before submitting more — quality over quantity!` },
        { status: 429 }
      )
    }

    // ── 5. Duplicate detection (same product within 24h) ───────
    const oneDayAgo = new Date(Date.now() - DUPLICATE_COOLDOWN_HOURS * 60 * 60 * 1000)
    const recentSameProduct = await db
      .select({ id: feedback.id, feedbackText: feedback.feedbackText })
      .from(feedback)
      .where(
        and(
          eq(feedback.userEmail, userEmail),
          eq(feedback.productId, productId),
          gte(feedback.createdAt, oneDayAgo)
        )
      )
      .orderBy(desc(feedback.createdAt))
      .limit(5)

    if (recentSameProduct.length > 0) {
      // Check text similarity — if > 80% of words overlap, reject
      for (const existing of recentSameProduct) {
        const existingWords = new Set(existing.feedbackText.toLowerCase().split(/\s+/))
        const newWords = trimmedText.toLowerCase().split(/\s+/)
        const overlapCount = newWords.filter(w => existingWords.has(w)).length
        const similarity = newWords.length > 0 ? overlapCount / newWords.length : 0

        if (similarity > 0.8) {
          return NextResponse.json(
            { error: 'You\'ve already submitted very similar feedback for this product recently. Please share a different perspective or try again after 24 hours.' },
            { status: 409 }
          )
        }
      }

      // Even if text differs, warn if too many for same product
      if (recentSameProduct.length >= 3) {
        return NextResponse.json(
          { error: 'You\'ve already submitted multiple reviews for this product today. Please come back tomorrow to share more feedback.' },
          { status: 429 }
        )
      }
    }

    // ── 6. Text normalization + sentiment ──────────────────────
    let originalLanguage: string | undefined
    let normalizedLanguage: string | undefined
    let normalizedText: string | undefined
    let sentimentResult: string | undefined

    try {
      const normalized = await normalizeTextForAnalytics(trimmedText)
      originalLanguage = normalized.originalLanguage || undefined
      normalizedLanguage = normalized.normalizedLanguage
      normalizedText = normalized.normalizedText
    } catch (err) {
      console.error('Text normalization failed (non-blocking):', err)
      normalizedText = trimmedText
      normalizedLanguage = 'en'
    }

    try {
      const sentiment = await analyzeSentiment(normalizedText || trimmedText)
      sentimentResult = sentiment.sentiment
    } catch (err) {
      console.error('Sentiment analysis failed (non-blocking):', err)
    }

    // ── 7. Insert (using session identity, not self-reported) ──
    const [created] = await db
      .insert(feedback)
      .values({
        productId,
        feedbackText: trimmedText,
        rating: rating || null,
        category: category || 'general',
        userName, // from session
        userEmail, // from session
        status: 'new',
        modalityPrimary: 'text',
        processingStatus: 'ready',
        originalLanguage: originalLanguage || null,
        normalizedLanguage: normalizedLanguage || null,
        normalizedText: normalizedText || null,
        sentiment: sentimentResult || null,
      })
      .returning()

    return NextResponse.json({
      success: true,
      feedbackId: created.id,
      sentiment: sentimentResult || null,
      originalLanguage: originalLanguage || null,
      message: 'Thank you for your feedback!',
    })
  } catch (error) {
    console.error('Feedback submission error:', error)
    return NextResponse.json(
      { error: 'Failed to submit feedback' },
      { status: 500 }
    )
  }
}
