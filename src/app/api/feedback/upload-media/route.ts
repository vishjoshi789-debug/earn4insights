import { put } from '@vercel/blob'
import { NextResponse } from 'next/server'
import { upsertFeedbackMedia } from '@/server/uploads/feedbackMediaRepo'
import { db } from '@/db'
import { feedback } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { auth } from '@/lib/auth/auth.config'
import { uploadRateLimit, ipFromRequest } from '@/lib/rate-limit-upstash'
import { awardPoints, hasPointsAwarded, MEDIA_BONUS_POINTS } from '@/server/pointsService'

// Images earn the presence bonus for the first 2 only (matches the
// submit-feedback quality meter: +5 at 1 image, +5 more at 2).
const MAX_BONUS_IMAGES = 2

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
    // Rate limit by IP (30 / 5min, distributed via Upstash)
    const rl = await uploadRateLimit.limit(ipFromRequest(request))
    if (!rl.success) {
      return NextResponse.json({ error: 'Too many uploads. Please wait.' }, { status: 429 })
    }

    // Auth check — only logged-in users can upload media
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

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

    // Verify feedback exists AND belongs to the current user
    const [existingFeedback] = await db
      .select({ id: feedback.id, userEmail: feedback.userEmail })
      .from(feedback)
      .where(eq(feedback.id, feedbackId))
      .limit(1)

    if (!existingFeedback) {
      return NextResponse.json({ error: 'Feedback not found' }, { status: 404 })
    }

    if (existingFeedback.userEmail !== session.user.email) {
      return NextResponse.json({ error: 'You can only upload media to your own feedback' }, { status: 403 })
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

    // ── Multimodal presence bonus (non-blocking) ──────────────────
    // Reward richer feedback on top of the base feedback_submit points,
    // matching the submit-feedback quality meter. Deduped per
    // (feedbackId, modality[, image index]) so retries / re-uploads of the
    // same slot never double-pay. The feedback owner == session user
    // (verified above), so we award to session.user.id.
    let bonusAwarded = 0
    try {
      const uid = (session.user as { id?: string }).id
      if (uid) {
        let bonusKey: string | null = null
        let bonusPoints = 0
        if (mediaType === 'audio') {
          bonusKey = `${feedbackId}:audio`
          bonusPoints = MEDIA_BONUS_POINTS.audio
        } else if (mediaType === 'video') {
          bonusKey = `${feedbackId}:video`
          bonusPoints = MEDIA_BONUS_POINTS.video
        } else if (mediaType === 'image' && imageIndex < MAX_BONUS_IMAGES) {
          bonusKey = `${feedbackId}:image:${imageIndex + 1}`
          bonusPoints = MEDIA_BONUS_POINTS.image
        }
        if (bonusKey && bonusPoints > 0 && !(await hasPointsAwarded(uid, 'media_bonus', bonusKey))) {
          await awardPoints(uid, bonusPoints, 'media_bonus', bonusKey, `Multimodal feedback bonus (${mediaType})`)
          bonusAwarded = bonusPoints
        }
      }
    } catch (err) {
      console.error('[upload-media] media presence bonus failed (non-blocking):', err)
    }

    // bonusAwarded lets the client tally the true total it earned (0 if this
    // media slot was already credited / over the image cap).
    return NextResponse.json({ success: true, mediaType, url: blob.url, bonusAwarded })
  } catch (error) {
    console.error('Feedback media upload error:', error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
