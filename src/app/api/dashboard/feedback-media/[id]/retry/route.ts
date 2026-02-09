import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { feedbackMedia, surveyResponses, feedback } from '@/db/schema'
import { requireRole } from '@/lib/auth/server'

function authErrorToStatus(err: unknown): number {
  const msg = err instanceof Error ? err.message : String(err)
  if (msg.toLowerCase().includes('forbidden')) return 403
  return 401
}

/**
 * POST /api/dashboard/feedback-media/:id/retry
 *
 * Re-queue failed media for processing:
 * - brand-authenticated via NextAuth session
 * - clears error fields
 * - sets status back to 'uploaded'
 * - sets owner processing_status to 'processing'
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

  const rows = await db
    .select()
    .from(feedbackMedia)
    .where(eq(feedbackMedia.id, id as any))
    .limit(1)

  if (rows.length === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const media = rows[0]
  if (media.mediaType !== 'audio' && media.mediaType !== 'video') {
    return NextResponse.json({ error: 'Invalid media type' }, { status: 400 })
  }

  // Re-queue media
  await db
    .update(feedbackMedia)
    .set({
      status: 'uploaded',
      errorCode: null,
      errorDetail: null,
      transcriptText: null,
      transcriptConfidence: null,
      originalLanguage: null,
      languageConfidence: null,
      // Allow an immediate manual retry (cron backoff uses lastErrorAt).
      lastErrorAt: null,
      updatedAt: new Date(),
    })
    .where(eq(feedbackMedia.id, id as any))

  // Update owner status + clear derived fields
  if (media.ownerType === 'survey_response') {
    await db
      .update(surveyResponses)
      .set({
        processingStatus: 'processing',
        transcriptText: null,
        transcriptConfidence: null,
        originalLanguage: null,
        languageConfidence: null,
        normalizedText: null,
        normalizedLanguage: null,
        sentiment: null,
      })
      .where(eq(surveyResponses.id, media.ownerId))
  }

  if (media.ownerType === 'feedback') {
    await db
      .update(feedback)
      .set({
        processingStatus: 'processing',
        transcriptText: null,
        transcriptConfidence: null,
        originalLanguage: null,
        languageConfidence: null,
        normalizedText: null,
        normalizedLanguage: null,
        sentiment: null,
      })
      .where(eq(feedback.id, media.ownerId as any))
  }

  return NextResponse.json({ success: true })
}

