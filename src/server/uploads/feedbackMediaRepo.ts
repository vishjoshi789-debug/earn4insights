import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/db'
import { feedbackMedia } from '@/db/schema'

export type FeedbackMediaOwnerType = 'survey_response' | 'feedback'
export type FeedbackMediaType = 'audio' | 'video'

export type UpsertFeedbackMediaParams = {
  ownerType: FeedbackMediaOwnerType
  ownerId: string
  mediaType: FeedbackMediaType
  storageProvider: 'vercel_blob'
  storageKey: string // we currently store blob.url as key
  mimeType?: string | null
  sizeBytes?: number | null
  durationMs?: number | null
}

/**
 * Idempotently inserts a feedback_media record.
 * We treat (ownerType, ownerId, storageKey) as the natural uniqueness key.
 */
export async function upsertFeedbackMedia(params: UpsertFeedbackMediaParams) {
  const existing = await db
    .select({ id: feedbackMedia.id })
    .from(feedbackMedia)
    .where(
      and(
        eq(feedbackMedia.ownerType, params.ownerType),
        eq(feedbackMedia.ownerId, params.ownerId),
        eq(feedbackMedia.storageKey, params.storageKey)
      )
    )
    .limit(1)

  if (existing.length > 0) return { id: existing[0].id }

  const [created] = await db
    .insert(feedbackMedia)
    .values({
      ownerType: params.ownerType,
      ownerId: params.ownerId,
      mediaType: params.mediaType,
      storageProvider: params.storageProvider,
      storageKey: params.storageKey,
      mimeType: params.mimeType ?? undefined,
      sizeBytes: params.sizeBytes ?? undefined,
      durationMs: params.durationMs ?? undefined,
      status: 'uploaded',
      retryCount: 0,
      updatedAt: new Date(),
    })
    .returning({ id: feedbackMedia.id })

  return created
}

export async function listFeedbackMediaForOwners(params: {
  ownerType: FeedbackMediaOwnerType
  ownerIds: string[]
  mediaType?: FeedbackMediaType
}) {
  if (params.ownerIds.length === 0) return []

  const whereClauses = [
    eq(feedbackMedia.ownerType, params.ownerType),
    inArray(feedbackMedia.ownerId, params.ownerIds),
  ]

  if (params.mediaType) {
    whereClauses.push(eq(feedbackMedia.mediaType, params.mediaType))
  }

  return await db
    .select({
      id: feedbackMedia.id,
      ownerId: feedbackMedia.ownerId,
      mediaType: feedbackMedia.mediaType,
      status: feedbackMedia.status,
      mimeType: feedbackMedia.mimeType,
      durationMs: feedbackMedia.durationMs,
      transcriptText: feedbackMedia.transcriptText,
      errorCode: feedbackMedia.errorCode,
      errorDetail: feedbackMedia.errorDetail,
      retryCount: feedbackMedia.retryCount,
      lastAttemptAt: feedbackMedia.lastAttemptAt,
      lastErrorAt: feedbackMedia.lastErrorAt,
      // Phase 2 foundation: moderation metadata
      moderationStatus: (feedbackMedia as any).moderationStatus,
      moderationNote: (feedbackMedia as any).moderationNote,
      moderatedAt: (feedbackMedia as any).moderatedAt,
      createdAt: feedbackMedia.createdAt,
    })
    .from(feedbackMedia)
    .where(and(...whereClauses))
}

