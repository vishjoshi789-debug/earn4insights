import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { NextResponse } from 'next/server'
import { getSurveyById } from '@/db/repositories/surveyRepository'
import { upsertFeedbackMedia } from '@/server/uploads/feedbackMediaRepo'

type ClientPayload = {
  // Used to authorize uploads for public survey pages
  surveyId?: string

  // Optional linkage (we’ll fully wire this in Phase 1)
  ownerType?: 'survey_response' | 'feedback'
  ownerId?: string

  // Hint for validation/routing
  mediaType?: 'audio' | 'video'
}

const AUDIO_CONTENT_TYPES = [
  'audio/webm',
  'audio/webm;codecs=opus',
  'audio/ogg',
  'audio/ogg;codecs=opus',
  'audio/mp4',
  'audio/mpeg',
  'audio/wav',
]

const VIDEO_CONTENT_TYPES = [
  'video/webm',
  'video/mp4',
  'video/quicktime',
]

function parseClientPayload(raw: unknown): ClientPayload {
  if (!raw) return {}
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as ClientPayload
    } catch {
      return {}
    }
  }
  if (typeof raw === 'object') return raw as ClientPayload
  return {}
}

/**
 * Client-upload token exchange for Vercel Blob.
 *
 * Used by `@vercel/blob/client` upload() as `handleUploadUrl`.
 * Phase 0 goal: provide secure scaffolding (no UI dependency yet).
 */
export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayloadRaw) => {
        const clientPayload = parseClientPayload(clientPayloadRaw)

        // Public survey pages still need server-side authorization.
        // We require a surveyId and only allow uploads if that survey has allowAudio/allowVideo enabled.
        if (!clientPayload.surveyId) {
          throw new Error('surveyId is required for uploads')
        }

        const survey = await getSurveyById(clientPayload.surveyId)
        if (!survey) {
          throw new Error('Survey not found')
        }

        const allowAudio = Boolean(survey.settings?.allowAudio)
        const allowVideo = Boolean(survey.settings?.allowVideo)

        const requestedMediaType: ClientPayload['mediaType'] =
          clientPayload.mediaType === 'video' ? 'video' : 'audio'

        if (requestedMediaType === 'audio' && !allowAudio) {
          throw new Error('Audio uploads are not enabled for this survey')
        }
        if (requestedMediaType === 'video' && !allowVideo) {
          throw new Error('Video uploads are not enabled for this survey')
        }

        const allowedContentTypes =
          requestedMediaType === 'video' ? VIDEO_CONTENT_TYPES : AUDIO_CONTENT_TYPES

        // Restrict uploads to our namespace.
        // The client can pick the pathname, so we enforce a stable prefix here.
        if (!pathname.startsWith('feedback-media/')) {
          throw new Error('Invalid upload pathname')
        }

        return {
          allowedContentTypes,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({
            surveyId: clientPayload.surveyId,
            ownerType: clientPayload.ownerType,
            ownerId: clientPayload.ownerId,
            mediaType: requestedMediaType,
          } satisfies ClientPayload),
        }
      },

      onUploadCompleted: async ({ blob, tokenPayload }) => {
        // Called by Vercel after the client upload finishes.
        // This won’t fire on pure localhost unless you use a tunnel (ngrok) or set VERCEL_BLOB_CALLBACK_URL.
        const payload = parseClientPayload(tokenPayload)

        // Store an attachment record if we have enough context.
        // (Phase 1 will reliably provide ownerType/ownerId once feedback entries are created.)
        if (payload.ownerType && payload.ownerId) {
          await upsertFeedbackMedia({
            ownerType: payload.ownerType,
            ownerId: payload.ownerId,
            mediaType: payload.mediaType === 'video' ? 'video' : 'audio',
            storageProvider: 'vercel_blob',
            storageKey: blob.url,
            mimeType: blob.contentType,
            // Some SDK versions don't type `size` on the callback blob result.
            sizeBytes: (blob as any).size,
          })
        }
      },
    })

    return NextResponse.json(jsonResponse)
  } catch (error) {
    // The webhook will retry 5 times waiting for a 200; return 400 for bad requests.
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 }
    )
  }
}

