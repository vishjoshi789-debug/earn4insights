import { NextResponse } from 'next/server'
import { db } from '@/db'
import { feedback } from '@/db/schema'
import { analyzeSentiment } from '@/server/sentimentService'
import { normalizeTextForAnalytics } from '@/server/textNormalizationService'

/**
 * POST /api/feedback/submit
 * 
 * Submit direct feedback for a product.
 * This is the public API for consumers to submit unstructured feedback
 * (reviews, complaints, praise) directly to a product.
 * 
 * Different from survey responses:
 * - Surveys: structured multi-question format
 * - Feedback: free-form text + rating + optional media
 * 
 * Body: {
 *   productId: string (required)
 *   feedbackText: string (required, min 3 chars)
 *   rating?: number (1-5)
 *   category?: 'general' | 'bug' | 'feature-request' | 'praise' | 'complaint'
 *   userName?: string
 *   userEmail?: string
 * }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      productId,
      feedbackText,
      rating,
      category,
      userName,
      userEmail,
    } = body

    // Validation
    if (!productId || typeof productId !== 'string') {
      return NextResponse.json(
        { error: 'productId is required' },
        { status: 400 }
      )
    }

    if (!feedbackText || typeof feedbackText !== 'string' || feedbackText.trim().length < 3) {
      return NextResponse.json(
        { error: 'feedbackText is required (min 3 characters)' },
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

    // Multilingual: detect language + normalize to English
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

    // Sentiment analysis on normalized text
    try {
      const sentiment = await analyzeSentiment(normalizedText || trimmedText)
      sentimentResult = sentiment.sentiment
    } catch (err) {
      console.error('Sentiment analysis failed (non-blocking):', err)
    }

    // Insert feedback
    const [created] = await db
      .insert(feedback)
      .values({
        productId,
        feedbackText: trimmedText,
        rating: rating || null,
        category: category || 'general',
        userName: userName || null,
        userEmail: userEmail || null,
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
