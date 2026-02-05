'use server'

import 'server-only'
import { upsertFeedbackMedia, type FeedbackMediaOwnerType, type FeedbackMediaType } from './feedbackMediaRepo'

export async function finalizeFeedbackMediaUpload(params: {
  ownerType: FeedbackMediaOwnerType
  ownerId: string
  mediaType: FeedbackMediaType
  blobUrl: string
  mimeType?: string
  sizeBytes?: number
  durationMs?: number
}) {
  return await upsertFeedbackMedia({
    ownerType: params.ownerType,
    ownerId: params.ownerId,
    mediaType: params.mediaType,
    storageProvider: 'vercel_blob',
    storageKey: params.blobUrl,
    mimeType: params.mimeType,
    sizeBytes: params.sizeBytes,
    durationMs: params.durationMs,
  })
}

