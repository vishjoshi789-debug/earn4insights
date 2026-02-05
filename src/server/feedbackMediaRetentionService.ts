import 'server-only'

import { del } from '@vercel/blob'
import { and, eq, isNotNull, lt, ne } from 'drizzle-orm'
import { db } from '@/db'
import { feedbackMedia } from '@/db/schema'

function getAudioRetentionDays(): number {
  const raw = process.env.AUDIO_MEDIA_RETENTION_DAYS
  if (!raw) return 30
  const n = Number(raw)
  return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : 30
}

function getVideoRetentionDays(): number {
  const raw = process.env.VIDEO_MEDIA_RETENTION_DAYS
  if (!raw) return 7
  const n = Number(raw)
  return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : 7
}

/**
 * Deletes raw audio blobs older than retention window AFTER transcript exists.
 * Keeps transcript/normalized fields in DB for analytics.
 */
export async function cleanupOldAudioMedia(params?: { limit?: number }) {
  const limit = params?.limit ?? 50
  const retentionDays = getAudioRetentionDays()

  if (retentionDays === 0) {
    return { success: true, deleted: 0, skipped: 0, message: 'Retention disabled (0 days)' }
  }

  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)

  const candidates = await db
    .select()
    .from(feedbackMedia)
    .where(
      and(
        eq(feedbackMedia.mediaType, 'audio'),
        eq(feedbackMedia.storageProvider, 'vercel_blob'),
        eq(feedbackMedia.status, 'ready'),
        isNotNull(feedbackMedia.transcriptText),
        lt(feedbackMedia.createdAt, cutoff),
        eq(feedbackMedia.deletedAt, null as any)
      )
    )
    .limit(limit)

  let deleted = 0
  let skipped = 0
  const results: Array<{ id: string; ok: boolean; error?: string }> = []

  for (const row of candidates) {
    try {
      // Delete blob by URL
      await del(row.storageKey)

      await db
        .update(feedbackMedia)
        .set({
          status: 'deleted',
          deletedAt: new Date(),
          retentionReason: `auto_retention_audio_${retentionDays}d`,
          updatedAt: new Date(),
        })
        .where(eq(feedbackMedia.id, row.id))

      deleted++
      results.push({ id: String(row.id), ok: true })
    } catch (err) {
      skipped++
      results.push({ id: String(row.id), ok: false, error: err instanceof Error ? err.message : String(err) })
    }
  }

  return {
    success: true,
    retentionDays,
    cutoff: cutoff.toISOString(),
    scanned: candidates.length,
    deleted,
    skipped,
    results,
  }
}

/**
 * Deletes raw video blobs older than retention window.
 *
 * Note: Phase 2 foundation does not run STT on video yet, so we do NOT require a transcript.
 * Default retention is intentionally short because video is sensitive and expensive.
 */
export async function cleanupOldVideoMedia(params?: { limit?: number }) {
  const limit = params?.limit ?? 50
  const retentionDays = getVideoRetentionDays()

  if (retentionDays === 0) {
    return { success: true, deleted: 0, skipped: 0, message: 'Retention disabled (0 days)' }
  }

  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)

  const candidates = await db
    .select()
    .from(feedbackMedia)
    .where(
      and(
        eq(feedbackMedia.mediaType, 'video'),
        eq(feedbackMedia.storageProvider, 'vercel_blob'),
        lt(feedbackMedia.createdAt, cutoff),
        eq(feedbackMedia.deletedAt, null as any),
        ne(feedbackMedia.status, 'deleted')
      )
    )
    .limit(limit)

  let deleted = 0
  let skipped = 0
  const results: Array<{ id: string; ok: boolean; error?: string }> = []

  for (const row of candidates) {
    try {
      await del(row.storageKey)

      await db
        .update(feedbackMedia)
        .set({
          status: 'deleted',
          deletedAt: new Date(),
          retentionReason: `auto_retention_video_${retentionDays}d`,
          updatedAt: new Date(),
        })
        .where(eq(feedbackMedia.id, row.id))

      deleted++
      results.push({ id: String(row.id), ok: true })
    } catch (err) {
      skipped++
      results.push({ id: String(row.id), ok: false, error: err instanceof Error ? err.message : String(err) })
    }
  }

  return {
    success: true,
    retentionDays,
    cutoff: cutoff.toISOString(),
    scanned: candidates.length,
    deleted,
    skipped,
    results,
  }
}

