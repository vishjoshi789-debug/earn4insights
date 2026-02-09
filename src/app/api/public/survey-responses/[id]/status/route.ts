import { NextResponse } from 'next/server'
import { and, desc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { feedbackMedia, surveyResponses } from '@/db/schema'

/**
 * GET /api/public/survey-responses/:id/status
 *
 * Public, minimal status endpoint for the submitting client to check
 * background processing state (voice/audio).
 *
 * Note: This intentionally returns NO answers or PII.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  }

  const [resp] = await db
    .select({
      id: surveyResponses.id,
      processingStatus: surveyResponses.processingStatus,
    })
    .from(surveyResponses)
    .where(eq(surveyResponses.id, id))
    .limit(1)

  if (!resp) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const [audio] = await db
    .select({
      status: feedbackMedia.status,
      errorCode: feedbackMedia.errorCode,
      retryCount: feedbackMedia.retryCount,
      lastAttemptAt: feedbackMedia.lastAttemptAt,
      lastErrorAt: feedbackMedia.lastErrorAt,
    })
    .from(feedbackMedia)
    .where(
      and(
        eq(feedbackMedia.ownerType, 'survey_response'),
        eq(feedbackMedia.ownerId, id),
        eq(feedbackMedia.mediaType, 'audio')
      )
    )
    .orderBy(desc(feedbackMedia.createdAt))
    .limit(1)

  const [video] = await db
    .select({
      status: feedbackMedia.status,
      errorCode: feedbackMedia.errorCode,
      retryCount: feedbackMedia.retryCount,
      lastAttemptAt: feedbackMedia.lastAttemptAt,
      lastErrorAt: feedbackMedia.lastErrorAt,
    })
    .from(feedbackMedia)
    .where(
      and(
        eq(feedbackMedia.ownerType, 'survey_response'),
        eq(feedbackMedia.ownerId, id),
        eq(feedbackMedia.mediaType, 'video')
      )
    )
    .orderBy(desc(feedbackMedia.createdAt))
    .limit(1)

  return NextResponse.json({
    success: true,
    response: {
      id: resp.id,
      processingStatus: resp.processingStatus,
    },
    audio: audio
      ? {
          status: audio.status,
          errorCode: audio.errorCode,
          retryCount: audio.retryCount,
          lastAttemptAt: audio.lastAttemptAt ? audio.lastAttemptAt.toISOString() : null,
          lastErrorAt: audio.lastErrorAt ? audio.lastErrorAt.toISOString() : null,
        }
      : null,
    video: video
      ? {
          status: video.status,
          errorCode: video.errorCode,
          retryCount: video.retryCount,
          lastAttemptAt: video.lastAttemptAt ? video.lastAttemptAt.toISOString() : null,
          lastErrorAt: video.lastErrorAt ? video.lastErrorAt.toISOString() : null,
        }
      : null,
  })
}

