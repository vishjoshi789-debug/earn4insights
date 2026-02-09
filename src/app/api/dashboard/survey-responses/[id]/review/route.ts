import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { feedbackMedia } from '@/db/schema'
import { requireRole } from '@/lib/auth/server'
import { analyzeSentiment } from '@/server/sentimentService'
import { updateSurveyResponseById } from '@/db/repositories/surveyRepository'

function authErrorToStatus(err: unknown): number {
  const msg = err instanceof Error ? err.message : String(err)
  if (msg.toLowerCase().includes('forbidden')) return 403
  return 401
}

function cleanLang(value: unknown): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value !== 'string') return undefined
  const s = value.trim()
  if (!s) return null
  // Keep validation intentionally permissive (ISO-639-1 recommended, but allow 'und', etc.)
  if (s.length > 16) return undefined
  return s
}

function cleanText(value: unknown): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value !== 'string') return undefined
  const s = value.trim()
  return s ? s : null
}

/**
 * POST /api/dashboard/survey-responses/:id/review
 *
 * Brand-only review/override for analytics fields:
 * - override language fields
 * - edit normalizedText and recompute sentiment
 * - optionally clear transcript (also clears transcript on attached audio media rows)
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole('brand')
  } catch (err) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: authErrorToStatus(err) })
  }

  const { id } = await context.params
  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  }

  let body: any = null
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const originalLanguage = cleanLang(body?.originalLanguage)
  const normalizedLanguage = cleanLang(body?.normalizedLanguage)
  const normalizedText = cleanText(body?.normalizedText)
  const clearTranscript = body?.clearTranscript === true
  const recomputeSentiment = body?.recomputeSentiment === true

  const updates: Parameters<typeof updateSurveyResponseById>[1] = {}
  if (originalLanguage !== undefined) updates.originalLanguage = originalLanguage
  if (normalizedLanguage !== undefined) updates.normalizedLanguage = normalizedLanguage
  if (normalizedText !== undefined) updates.normalizedText = normalizedText

  // If normalized text is edited, keep sentiment consistent (unless text is empty).
  if ((normalizedText !== undefined && normalizedText !== null) || recomputeSentiment) {
    const textForSentiment =
      normalizedText !== undefined ? (normalizedText || '') : String(body?.normalizedText || '')
    const cleaned = textForSentiment.trim()
    if (!cleaned) {
      updates.sentiment = null
    } else {
      const sentiment = await analyzeSentiment(cleaned)
      updates.sentiment = sentiment.sentiment
    }
  }

  if (clearTranscript) {
    updates.transcriptText = null
  }

  if (Object.keys(updates).length > 0) {
    await updateSurveyResponseById(id, updates)
  }

  if (clearTranscript) {
    // Also clear transcript text on attached audio media, so the dashboard doesn’t fall back to it.
    await db
      .update(feedbackMedia)
      .set({
        transcriptText: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(feedbackMedia.ownerType, 'survey_response'),
          eq(feedbackMedia.ownerId, id),
          eq(feedbackMedia.mediaType, 'audio')
        )
      )
  }

  return NextResponse.json({ success: true })
}

