import { put } from '@vercel/blob'
import { NextResponse } from 'next/server'
import { getSurveyById, updateSurveyResponseById } from '@/db/repositories/surveyRepository'
import { upsertFeedbackMedia } from '@/server/uploads/feedbackMediaRepo'

const MAX_BYTES = 4 * 1024 * 1024 // stay safely under Vercel 4.5MB limit

const ALLOWED_AUDIO_CONTENT_TYPES = new Set([
  'audio/webm',
  'audio/webm;codecs=opus',
  'audio/ogg',
  'audio/ogg;codecs=opus',
  'audio/mp4',
  'audio/mpeg',
  'audio/wav',
])

const ALLOWED_VIDEO_CONTENT_TYPES = new Set([
  'video/webm',
  'video/webm;codecs=vp8',
  'video/webm;codecs=vp9',
  'video/mp4',
  'video/quicktime',
])

const MAX_VIDEO_DURATION_MS = 15_000

function asString(value: FormDataEntryValue | null): string | null {
  if (!value) return null
  if (typeof value === 'string') return value
  return null
}

function asInt(value: FormDataEntryValue | null): number | null {
  const s = asString(value)
  if (!s) return null
  const n = Number(s)
  return Number.isFinite(n) ? Math.trunc(n) : null
}

/**
 * Server-side upload for voice feedback.
 *
 * Note: Vercel Blob is "unlisted by URL" (URLs are public but hard to guess when random suffix is used).
 * This endpoint lets us enforce size/type checks and store references server-side.
 */
export async function POST(request: Request) {
  try {
    const form = await request.formData()

    const surveyId = asString(form.get('surveyId'))
    const responseId = asString(form.get('responseId'))
    const mediaType = (asString(form.get('mediaType')) || 'audio') as 'audio' | 'video'
    const consentAudio = asString(form.get('consentAudio')) === 'true'
    const consentVideo = asString(form.get('consentVideo')) === 'true'
    const modalityPrimary = asString(form.get('modalityPrimary')) || 'audio'
    const durationMs = asInt(form.get('durationMs'))
    const file = form.get('file')

    if (!surveyId || !responseId) {
      return NextResponse.json({ error: 'surveyId and responseId are required' }, { status: 400 })
    }

    if (mediaType !== 'audio' && mediaType !== 'video') {
      return NextResponse.json({ error: 'Invalid mediaType' }, { status: 400 })
    }

    if (mediaType === 'audio' && !consentAudio) {
      return NextResponse.json({ error: 'Audio consent is required' }, { status: 400 })
    }
    if (mediaType === 'video' && !consentVideo) {
      return NextResponse.json({ error: 'Video consent is required' }, { status: 400 })
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'file is required' }, { status: 400 })
    }

    if (file.size <= 0) {
      return NextResponse.json({ error: 'Empty file' }, { status: 400 })
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: `File too large (max ${MAX_BYTES} bytes)` },
        { status: 413 }
      )
    }

    const contentType = file.type || 'audio/webm'
    if (mediaType === 'audio' && !ALLOWED_AUDIO_CONTENT_TYPES.has(contentType)) {
      return NextResponse.json({ error: `Unsupported content type: ${contentType}` }, { status: 415 })
    }
    if (mediaType === 'video' && !ALLOWED_VIDEO_CONTENT_TYPES.has(contentType)) {
      return NextResponse.json({ error: `Unsupported content type: ${contentType}` }, { status: 415 })
    }

    const survey = await getSurveyById(surveyId)
    if (!survey) {
      return NextResponse.json({ error: 'Survey not found' }, { status: 404 })
    }
    if (mediaType === 'audio' && !survey.settings?.allowAudio) {
      return NextResponse.json({ error: 'Audio uploads are not enabled for this survey' }, { status: 403 })
    }
    if (mediaType === 'video' && !survey.settings?.allowVideo) {
      return NextResponse.json({ error: 'Video uploads are not enabled for this survey' }, { status: 403 })
    }

    if (mediaType === 'video' && typeof durationMs === 'number' && durationMs > MAX_VIDEO_DURATION_MS) {
      return NextResponse.json({ error: `Video too long (max ${MAX_VIDEO_DURATION_MS}ms)` }, { status: 413 })
    }

    const safeExt =
      contentType.includes('mp4') ? 'mp4' :
      contentType.includes('quicktime') ? 'mov' :
      contentType.includes('ogg') ? 'ogg' :
      'webm'

    const kind = mediaType === 'video' ? 'video' : 'voice'
    const pathname = `feedback-media/${surveyId}/${responseId}/${kind}.${safeExt}`

    const blob = await put(pathname, file, {
      access: 'public',
      addRandomSuffix: true,
      contentType,
    })

    await upsertFeedbackMedia({
      ownerType: 'survey_response',
      ownerId: responseId,
      mediaType,
      storageProvider: 'vercel_blob',
      storageKey: blob.url,
      mimeType: blob.contentType,
      sizeBytes: file.size,
      durationMs: durationMs ?? undefined,
    })

    if (mediaType === 'audio') {
      await updateSurveyResponseById(responseId, {
        modalityPrimary,
        // Lifecycle fix (Phase 1.5): once audio is uploaded, the response is "processing"
        // until the STT pipeline completes (cron flips to ready/failed).
        processingStatus: 'processing',
        consentAudio: true,
        consentCapturedAt: new Date(),
      })
    } else {
      await updateSurveyResponseById(responseId, {
        modalityPrimary,
        // Phase 2: once video is uploaded, the response is "processing"
        // until the STT pipeline completes (cron flips to ready/failed).
        processingStatus: 'processing',
        consentVideo: true,
        consentCapturedAt: new Date(),
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

