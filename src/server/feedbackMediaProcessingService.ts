import 'server-only'

import OpenAI from 'openai'
import { and, eq, lt, isNotNull } from 'drizzle-orm'
import { db } from '@/db'
import { feedbackMedia, surveyResponses, feedback } from '@/db/schema'
import { analyzeSentiment } from '@/server/sentimentService'

type ProcessingResult =
  | {
      ok: true
      transcriptText: string
      originalLanguage: string | null
      normalizedText: string
      normalizedLanguage: string
      sentiment: 'positive' | 'neutral' | 'negative'
    }
  | {
      ok: false
      errorCode: string
      errorDetail: string
    }

function requireOpenAIKey(): string {
  const key = process.env.OPENAI_API_KEY
  if (!key) throw new Error('OPENAI_API_KEY is not set')
  return key
}

function asInt(value: string | undefined | null, fallback: number): number {
  if (!value) return fallback
  const n = Number(value)
  return Number.isFinite(n) ? Math.trunc(n) : fallback
}

function getMaxRetries(): number {
  return asInt(process.env.FEEDBACK_MEDIA_MAX_RETRIES, 3)
}

function getBackoffBaseSeconds(): number {
  return asInt(process.env.FEEDBACK_MEDIA_RETRY_BACKOFF_BASE_SECONDS, 60)
}

function getProcessingTimeoutSeconds(): number {
  // If a job is "processing" beyond this, we assume the worker crashed/hung.
  return asInt(process.env.FEEDBACK_MEDIA_PROCESSING_TIMEOUT_SECONDS, 15 * 60)
}

function backoffSeconds(retryCount: number): number {
  // Exponential backoff with a cap to avoid runaway delays.
  const base = Math.max(1, getBackoffBaseSeconds())
  const exp = Math.min(Math.max(0, retryCount), 8)
  return base * Math.pow(2, exp)
}

async function setOwnerProcessingStatus(params: {
  ownerType: string
  ownerId: string
  status: 'processing' | 'ready' | 'failed'
}) {
  if (params.ownerType === 'survey_response') {
    await db
      .update(surveyResponses)
      .set({ processingStatus: params.status })
      .where(eq(surveyResponses.id, params.ownerId))
  }
  if (params.ownerType === 'feedback') {
    await db
      .update(feedback)
      .set({ processingStatus: params.status })
      .where(eq(feedback.id, params.ownerId as any))
  }
}

async function fetchAsFile(url: string, filename: string, fallbackType: string) {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Failed to fetch media: ${res.status}`)
  }
  const arrayBuffer = await res.arrayBuffer()
  const contentType = res.headers.get('content-type') || fallbackType
  // Node 20+ provides File/Blob in the runtime (Next.js route handlers run on Node by default here).
  return new File([arrayBuffer], filename, { type: contentType })
}

async function transcribeAndNormalizeFromBlobUrl(params: {
  blobUrl: string
  filename: string
  fallbackType: string
}): Promise<ProcessingResult> {
  try {
    const apiKey = requireOpenAIKey()
    const client = new OpenAI({ apiKey })

    const mediaFile = await fetchAsFile(params.blobUrl, params.filename, params.fallbackType)

    // 1) Transcribe (original language)
    const transcription: any = await client.audio.transcriptions.create({
      file: mediaFile,
      model: process.env.OPENAI_STT_MODEL || 'whisper-1',
      response_format: 'verbose_json',
    } as any)

    const transcriptText: string = transcription?.text || ''
    const originalLanguage: string | null = transcription?.language || null

    if (!transcriptText.trim()) {
      return {
        ok: false,
        errorCode: 'empty_transcript',
        errorDetail: 'Transcription returned empty text',
      }
    }

    // 2) Translate to normalized language (default en)
    const normalizedLanguage = process.env.NORMALIZED_LANGUAGE || 'en'
    let normalizedText = transcriptText

    if (normalizedLanguage === 'en') {
      // Whisper translation endpoint translates to English.
      if (originalLanguage && originalLanguage.toLowerCase() !== 'en') {
        const translation: any = await client.audio.translations.create({
          file: mediaFile,
          model: process.env.OPENAI_STT_MODEL || 'whisper-1',
        } as any)
        const translated = (translation?.text || '').trim()
        if (translated) normalizedText = translated
      }
    } else {
      // Minimal fallback: keep transcript; upgrade later if you want multi-target translation.
      normalizedText = transcriptText
    }

    // 3) Sentiment on normalized text (startup-friendly keyword model)
    const sentimentResult = await analyzeSentiment(normalizedText)

    return {
      ok: true,
      transcriptText,
      originalLanguage,
      normalizedText,
      normalizedLanguage,
      sentiment: sentimentResult.sentiment,
    }
  } catch (err) {
    return {
      ok: false,
      errorCode: err instanceof Error && err.message.includes('OPENAI_API_KEY') ? 'missing_openai_key' : 'processing_error',
      errorDetail: err instanceof Error ? err.message : String(err),
    }
  }
}

async function propagateToOwner(params: {
  ownerType: string
  ownerId: string
  processed: Extract<ProcessingResult, { ok: true }>
  // If true, only fill analytics fields when they are currently empty/null.
  // This prevents video processing from overwriting typed-text or prior audio analytics in "mixed" responses.
  onlyIfEmpty?: boolean
}) {
  const onlyIfEmpty = Boolean(params.onlyIfEmpty)

  if (params.ownerType === 'survey_response') {
    if (onlyIfEmpty) {
      const [row] = await db
        .select({
          transcriptText: surveyResponses.transcriptText,
          normalizedText: surveyResponses.normalizedText,
          normalizedLanguage: surveyResponses.normalizedLanguage,
          originalLanguage: surveyResponses.originalLanguage,
          sentiment: surveyResponses.sentiment,
        })
        .from(surveyResponses)
        .where(eq(surveyResponses.id, params.ownerId))
        .limit(1)

      const hasAnyAnalytics =
        Boolean((row?.normalizedText || '').trim()) ||
        Boolean((row?.transcriptText || '').trim()) ||
        Boolean(row?.sentiment) ||
        Boolean(row?.normalizedLanguage) ||
        Boolean(row?.originalLanguage)

      if (hasAnyAnalytics) {
        await db
          .update(surveyResponses)
          .set({
            processingStatus: 'ready',
          })
          .where(eq(surveyResponses.id, params.ownerId))
        return
      }
    }

    await db
      .update(surveyResponses)
      .set({
        transcriptText: params.processed.transcriptText,
        originalLanguage: params.processed.originalLanguage || undefined,
        normalizedText: params.processed.normalizedText,
        normalizedLanguage: params.processed.normalizedLanguage,
        sentiment: params.processed.sentiment,
        processingStatus: 'ready',
      })
      .where(eq(surveyResponses.id, params.ownerId))
    return
  }

  if (params.ownerType === 'feedback') {
    if (onlyIfEmpty) {
      const [row] = await db
        .select({
          transcriptText: feedback.transcriptText,
          normalizedText: feedback.normalizedText,
          normalizedLanguage: feedback.normalizedLanguage,
          originalLanguage: feedback.originalLanguage,
          sentiment: feedback.sentiment,
        })
        .from(feedback)
        .where(eq(feedback.id, params.ownerId as any))
        .limit(1)

      const hasAnyAnalytics =
        Boolean((row?.normalizedText || '').trim()) ||
        Boolean((row?.transcriptText || '').trim()) ||
        Boolean(row?.sentiment) ||
        Boolean(row?.normalizedLanguage) ||
        Boolean(row?.originalLanguage)

      if (hasAnyAnalytics) {
        await db
          .update(feedback)
          .set({
            processingStatus: 'ready',
          })
          .where(eq(feedback.id, params.ownerId as any))
        return
      }
    }

    await db
      .update(feedback)
      .set({
        transcriptText: params.processed.transcriptText,
        originalLanguage: params.processed.originalLanguage || undefined,
        normalizedText: params.processed.normalizedText,
        normalizedLanguage: params.processed.normalizedLanguage,
        sentiment: params.processed.sentiment,
        processingStatus: 'ready',
      })
      .where(eq(feedback.id, params.ownerId as any))
  }
}

export async function processPendingAudioFeedbackMedia(params?: { limit?: number }) {
  const limit = params?.limit ?? 10
  const maxRetries = getMaxRetries()
  const now = new Date()

  // 0) Detect stale "processing" jobs and re-queue them with backoff.
  // This protects against serverless crashes mid-job, leaving rows stuck forever.
  const timeoutSeconds = getProcessingTimeoutSeconds()
  const cutoff = new Date(now.getTime() - timeoutSeconds * 1000)
  const staleProcessing = await db
    .select()
    .from(feedbackMedia)
    .where(
      and(
        eq(feedbackMedia.mediaType, 'audio'),
        eq(feedbackMedia.status, 'processing'),
        isNotNull(feedbackMedia.lastAttemptAt),
        lt(feedbackMedia.lastAttemptAt, cutoff)
      )
    )
    .limit(Math.max(5, limit))

  for (const media of staleProcessing) {
    const retryCount = (media as any).retryCount ?? 0

    // If we've exhausted retries, mark failed permanently.
    if (retryCount >= maxRetries) {
      await db
        .update(feedbackMedia)
        .set({
          status: 'failed',
          errorCode: 'max_retries_exceeded',
          errorDetail: `Processing timed out and retry limit reached (${maxRetries}).`,
          lastErrorAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(feedbackMedia.id, media.id))
      await setOwnerProcessingStatus({ ownerType: media.ownerType, ownerId: media.ownerId, status: 'failed' })
      continue
    }

    await db
      .update(feedbackMedia)
      .set({
        status: 'uploaded',
        errorCode: 'processing_timeout_requeued',
        errorDetail: `Processing exceeded timeout (${timeoutSeconds}s). Re-queued with backoff.`,
        lastErrorAt: new Date(),
        retryCount: retryCount + 1,
        updatedAt: new Date(),
      })
      .where(eq(feedbackMedia.id, media.id))

    // Keep owner "processing" to avoid showing a hard failure to consumers/admins.
    await setOwnerProcessingStatus({ ownerType: media.ownerType, ownerId: media.ownerId, status: 'processing' })
  }

  const pending = await db
    .select()
    .from(feedbackMedia)
    .where(and(eq(feedbackMedia.mediaType, 'audio'), eq(feedbackMedia.status, 'uploaded')))
    .limit(limit * 5)

  const results = []

  for (const media of pending) {
    const retryCount = (media as any).retryCount ?? 0

    if (retryCount >= maxRetries) {
      await db
        .update(feedbackMedia)
        .set({
          status: 'failed',
          errorCode: 'max_retries_exceeded',
          errorDetail: `Retry limit reached (${maxRetries}).`,
          lastErrorAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(feedbackMedia.id, media.id))
      await setOwnerProcessingStatus({ ownerType: media.ownerType, ownerId: media.ownerId, status: 'failed' })
      results.push({ id: media.id, success: false, error: 'max_retries_exceeded' })
      continue
    }

    // Backoff gate: if the last error was recent, skip for now.
    if (media.lastErrorAt) {
      const waitSeconds = backoffSeconds(retryCount)
      const eligibleAt = new Date(media.lastErrorAt.getTime() + waitSeconds * 1000)
      if (eligibleAt > now) {
        continue
      }
    }

    // mark processing
    await db
      .update(feedbackMedia)
      .set({
        status: 'processing',
        lastAttemptAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(feedbackMedia.id, media.id))

    // reflect processing state on the owner record for dashboard UX
    await setOwnerProcessingStatus({ ownerType: media.ownerType, ownerId: media.ownerId, status: 'processing' })

    const processed = await transcribeAndNormalizeFromBlobUrl({
      blobUrl: media.storageKey,
      filename: 'voice.webm',
      fallbackType: 'audio/webm',
    })

    if (!processed.ok) {
      await db
        .update(feedbackMedia)
        .set({
          status: 'failed',
          errorCode: processed.errorCode,
          errorDetail: processed.errorDetail,
          lastErrorAt: new Date(),
          retryCount: retryCount + 1,
          updatedAt: new Date(),
        })
        .where(eq(feedbackMedia.id, media.id))

      // Propagate failure state to owner record for UX visibility
      await setOwnerProcessingStatus({ ownerType: media.ownerType, ownerId: media.ownerId, status: 'failed' })

      results.push({ id: media.id, success: false, error: processed.errorCode })
      continue
    }

    await db
      .update(feedbackMedia)
      .set({
        status: 'ready',
        transcriptText: processed.transcriptText,
        originalLanguage: processed.originalLanguage || undefined,
        errorCode: null,
        errorDetail: null,
        lastErrorAt: null,
        updatedAt: new Date(),
      })
      .where(eq(feedbackMedia.id, media.id))

    // Propagate to owner record for unified analytics
    await propagateToOwner({ ownerType: media.ownerType, ownerId: media.ownerId, processed })

    results.push({ id: media.id, success: true })

    if (results.length >= limit) break
  }

  return {
    success: true,
    processed: results.length,
    results,
  }
}

export async function processPendingVideoFeedbackMedia(params?: { limit?: number }) {
  const limit = params?.limit ?? 10
  const maxRetries = getMaxRetries()
  const now = new Date()

  // 0) Detect stale "processing" jobs and re-queue them with backoff.
  const timeoutSeconds = getProcessingTimeoutSeconds()
  const cutoff = new Date(now.getTime() - timeoutSeconds * 1000)
  const staleProcessing = await db
    .select()
    .from(feedbackMedia)
    .where(
      and(
        eq(feedbackMedia.mediaType, 'video'),
        eq(feedbackMedia.status, 'processing'),
        isNotNull(feedbackMedia.lastAttemptAt),
        lt(feedbackMedia.lastAttemptAt, cutoff)
      )
    )
    .limit(Math.max(5, limit))

  for (const media of staleProcessing) {
    const retryCount = (media as any).retryCount ?? 0

    if (retryCount >= maxRetries) {
      await db
        .update(feedbackMedia)
        .set({
          status: 'failed',
          errorCode: 'max_retries_exceeded',
          errorDetail: `Processing timed out and retry limit reached (${maxRetries}).`,
          lastErrorAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(feedbackMedia.id, media.id))
      await setOwnerProcessingStatus({ ownerType: media.ownerType, ownerId: media.ownerId, status: 'failed' })
      continue
    }

    await db
      .update(feedbackMedia)
      .set({
        status: 'uploaded',
        errorCode: 'processing_timeout_requeued',
        errorDetail: `Processing exceeded timeout (${timeoutSeconds}s). Re-queued with backoff.`,
        lastErrorAt: new Date(),
        retryCount: retryCount + 1,
        updatedAt: new Date(),
      })
      .where(eq(feedbackMedia.id, media.id))

    await setOwnerProcessingStatus({ ownerType: media.ownerType, ownerId: media.ownerId, status: 'processing' })
  }

  const pending = await db
    .select()
    .from(feedbackMedia)
    .where(and(eq(feedbackMedia.mediaType, 'video'), eq(feedbackMedia.status, 'uploaded')))
    .limit(limit * 5)

  const results = []

  for (const media of pending) {
    const retryCount = (media as any).retryCount ?? 0

    if (retryCount >= maxRetries) {
      await db
        .update(feedbackMedia)
        .set({
          status: 'failed',
          errorCode: 'max_retries_exceeded',
          errorDetail: `Retry limit reached (${maxRetries}).`,
          lastErrorAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(feedbackMedia.id, media.id))
      await setOwnerProcessingStatus({ ownerType: media.ownerType, ownerId: media.ownerId, status: 'failed' })
      results.push({ id: media.id, success: false, error: 'max_retries_exceeded' })
      continue
    }

    if (media.lastErrorAt) {
      const waitSeconds = backoffSeconds(retryCount)
      const eligibleAt = new Date(media.lastErrorAt.getTime() + waitSeconds * 1000)
      if (eligibleAt > now) {
        continue
      }
    }

    await db
      .update(feedbackMedia)
      .set({
        status: 'processing',
        lastAttemptAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(feedbackMedia.id, media.id))

    await setOwnerProcessingStatus({ ownerType: media.ownerType, ownerId: media.ownerId, status: 'processing' })

    const processed = await transcribeAndNormalizeFromBlobUrl({
      blobUrl: media.storageKey,
      filename: 'video.webm',
      fallbackType: 'video/webm',
    })

    if (!processed.ok) {
      await db
        .update(feedbackMedia)
        .set({
          status: 'failed',
          errorCode: processed.errorCode,
          errorDetail: processed.errorDetail,
          lastErrorAt: new Date(),
          retryCount: retryCount + 1,
          updatedAt: new Date(),
        })
        .where(eq(feedbackMedia.id, media.id))

      await setOwnerProcessingStatus({ ownerType: media.ownerType, ownerId: media.ownerId, status: 'failed' })
      results.push({ id: media.id, success: false, error: processed.errorCode })
      continue
    }

    await db
      .update(feedbackMedia)
      .set({
        status: 'ready',
        transcriptText: processed.transcriptText,
        originalLanguage: processed.originalLanguage || undefined,
        errorCode: null,
        errorDetail: null,
        lastErrorAt: null,
        updatedAt: new Date(),
      })
      .where(eq(feedbackMedia.id, media.id))

    // For video, avoid overwriting typed-text/audio analytics on mixed responses.
    await propagateToOwner({
      ownerType: media.ownerType,
      ownerId: media.ownerId,
      processed,
      onlyIfEmpty: true,
    })

    results.push({ id: media.id, success: true })

    if (results.length >= limit) break
  }

  return {
    success: true,
    processed: results.length,
    results,
  }
}

