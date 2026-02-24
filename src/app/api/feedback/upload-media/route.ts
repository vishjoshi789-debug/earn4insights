import { put } from '@vercel/blob'
import { NextResponse } from 'next/server'
import { upsertFeedbackMedia } from '@/server/uploads/feedbackMediaRepo'
import { db } from '@/db'
import { feedback } from '@/db/schema'
import { eq } from 'drizzle-orm'

const MAX_AUDIO_BYTES = 4 * 1024 * 1024  // 4MB
const MAX_VIDEO_BYTES = 10 * 1024 * 1024  // 10MB
const MAX_IMAGE_BYTES = 5 * 1024 * 1024  // 5MB

const ALLOWED_AUDIO_CONTENT_TYPES = new Set([
  'audio/webm', 'audio/webm;codecs=opus', 'audio/ogg',
  'audio/ogg;codecs=opus', 'audio/mp4', 'audio/mpeg', 'audio/wav',
])

const ALLOWED_VIDEO_CONTENT_TYPES = new Set([
  'video/webm', 'video/webm;codecs=vp8', 'video/webm;codecs=vp9',
  'video/mp4', 'video/quicktime',
])

const ALLOWED_IMAGE_CONTENT_TYPES = new Set([
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
])

const MAX_VIDEO_DURATION_MS = 60_000

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
 * POST /api/feedback/upload-media
 * 
 * Upload media (audio, video, image) for a direct feedback entry.
 * This is separate from the survey-based upload route because:
 * - No surveyId is required
 * - Ownership is 'feedback' not 'survey_response'
 * - No survey feature-flag checks
 * 
 * FormData: {
 *   feedbackId: string (required)
 *   mediaType: 'audio' | 'video' | 'image' (required)
 *   file: File (required)
 *   durationMs?: number (for audio/video)
 *   imageIndex?: number (for images, 0-based)
 * }
 */
export async function POST(request: Request) {
  try {
    const form = await request.formData()

    const feedbackId = asString(form.get('feedbackId'))
    const mediaType = (asString(form.get('mediaType')) || 'audio') as 'audio' | 'video' | 'image'
    const durationMs = asInt(form.get('durationMs'))
    const imageIndex = asInt(form.get('imageIndex')) || 0
    const file = form.get('file')

    // Validation
    if (!feedbackId) {
      return NextResponse.json({ error: 'feedbackId is required' }, { status: 400 })
    }

    if (!['audio', 'video', 'image'].includes(mediaType)) {
      return NextResponse.json({ error: 'Invalid mediaType' }, { status: 400 })
    }

    if (!(file instanceof File) || file.size <= 0) {
      return NextResponse.json({ error: 'Valid file is required' }, { status: 400 })
    }

    // Verify feedback exists
    const [existingFeedback] = await db
      .select({ id: feedback.id })
      .from(feedback)
      .where(eq(feedback.id, feedbackId))
      .limit(1)

    if (!existingFeedback) {
      return NextResponse.json({ error: 'Feedback not found' }, { status: 404 })
    }

    // Size limits
    const maxSize = mediaType === 'image' ? MAX_IMAGE_BYTES
      : mediaType === 'video' ? MAX_VIDEO_BYTES
      : MAX_AUDIO_BYTES

    if (file.size > maxSize) {
      return NextResponse.json(
        { error: `File too large (max ${Math.round(maxSize / 1024 / 1024)}MB)` },
        { status: 413 }
      )
    }

    // Content type validation
    const contentType = file.type || 'application/octet-stream'
    if (mediaType === 'audio' && !ALLOWED_AUDIO_CONTENT_TYPES.has(contentType)) {
      return NextResponse.json({ error: `Unsupported audio type: ${contentType}` }, { status: 415 })
    }
    if (mediaType === 'video' && !ALLOWED_VIDEO_CONTENT_TYPES.has(contentType)) {
      return NextResponse.json({ error: `Unsupported video type: ${contentType}` }, { status: 415 })
    }
    if (mediaType === 'image' && !ALLOWED_IMAGE_CONTENT_TYPES.has(contentType)) {
      return NextResponse.json({ error: `Unsupported image type: ${contentType}` }, { status: 415 })
    }

    // Video duration cap
    if (mediaType === 'video' && typeof durationMs === 'number' && durationMs > MAX_VIDEO_DURATION_MS) {
      return NextResponse.json({ error: `Video too long (max ${MAX_VIDEO_DURATION_MS / 1000}s)` }, { status: 413 })
    }

    // File extension
    const safeExt =
      mediaType === 'image' ? (
        contentType.includes('png') ? 'png' :
        contentType.includes('webp') ? 'webp' :
        'jpg'
      ) :
      mediaType === 'video' ? (
        contentType.includes('mp4') ? 'mp4' :
        contentType.includes('quicktime') ? 'mov' :
        'webm'
      ) :
      contentType.includes('mp4') ? 'mp4' :
      contentType.includes('ogg') ? 'ogg' :
      contentType.includes('mpeg') ? 'mp3' :
      'webm'

    const kind = mediaType === 'video' ? 'video' :
      mediaType === 'image' ? `image-${imageIndex}` :
      'voice'

    const pathname = `feedback-media/direct/${feedbackId}/${kind}.${safeExt}`

    // Upload to Vercel Blob
    const blob = await put(pathname, file, {
      access: 'public',
      addRandomSuffix: true,
      contentType,
    })

    // Store media reference
    await upsertFeedbackMedia({
      ownerType: 'feedback',
      ownerId: feedbackId,
      mediaType,
      storageProvider: 'vercel_blob',
      storageKey: blob.url,
      mimeType: blob.contentType,
      sizeBytes: file.size,
      durationMs: durationMs ?? undefined,
    })

    // Update feedback modality
    const newModality = mediaType === 'audio' ? 'audio' :
      mediaType === 'video' ? 'video' : 'mixed'

    const updateData: Record<string, any> = {
      modalityPrimary: newModality,
    }

    if (mediaType === 'audio') {
      updateData.processingStatus = 'processing'
      updateData.consentAudio = true
      updateData.consentCapturedAt = new Date()
    } else if (mediaType === 'video') {
      updateData.processingStatus = 'processing'
      updateData.consentVideo = true
      updateData.consentCapturedAt = new Date()
    }

    await db.update(feedback)
      .set(updateData)
      .where(eq(feedback.id, feedbackId))

    return NextResponse.json({ success: true, mediaType, url: blob.url })
  } catch (error) {
    console.error('Feedback media upload error:', error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
