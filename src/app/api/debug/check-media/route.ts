import { NextResponse } from 'next/server'
import { db } from '@/db'
import { feedback, feedbackMedia } from '@/db/schema'
import { eq, desc, inArray, sql } from 'drizzle-orm'

/**
 * Temporary diagnostic endpoint to check media data.
 * GET /api/debug/check-media?productId=xxx
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const productId = searchParams.get('productId')

  if (!productId) {
    return NextResponse.json({ error: 'productId required' }, { status: 400 })
  }

  try {
    // 1. Get feedback for this product
    const feedbackItems = await db
      .select({
        id: feedback.id,
        userName: feedback.userName,
        userEmail: feedback.userEmail,
        modalityPrimary: feedback.modalityPrimary,
        feedbackText: feedback.feedbackText,
        rating: feedback.rating,
        createdAt: feedback.createdAt,
      })
      .from(feedback)
      .where(eq(feedback.productId, productId))
      .orderBy(desc(feedback.createdAt))
      .limit(10)

    // 2. Check feedback_media for these IDs
    const ids = feedbackItems.map(f => f.id)
    let mediaItems: any[] = []
    let mediaError: string | null = null

    if (ids.length > 0) {
      try {
        mediaItems = await db
          .select({
            id: feedbackMedia.id,
            ownerType: feedbackMedia.ownerType,
            ownerId: feedbackMedia.ownerId,
            mediaType: feedbackMedia.mediaType,
            status: feedbackMedia.status,
            moderationStatus: feedbackMedia.moderationStatus,
            storageKey: feedbackMedia.storageKey,
            mimeType: feedbackMedia.mimeType,
            durationMs: feedbackMedia.durationMs,
          })
          .from(feedbackMedia)
          .where(inArray(feedbackMedia.ownerId, ids))
      } catch (e: any) {
        mediaError = e.message
      }
    }

    // 3. Total media count
    let totalMedia = 0
    try {
      const [row] = await db.select({ cnt: sql<number>`count(*)` }).from(feedbackMedia)
      totalMedia = row?.cnt || 0
    } catch { }

    return NextResponse.json({
      feedbackCount: feedbackItems.length,
      feedbackItems: feedbackItems.map(f => ({
        id: f.id,
        userName: f.userName,
        modality: f.modalityPrimary,
        rating: f.rating,
        textPreview: f.feedbackText?.substring(0, 50),
        createdAt: f.createdAt,
      })),
      mediaForTheseFeedbacks: mediaItems,
      mediaError,
      totalMediaInDb: totalMedia,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
