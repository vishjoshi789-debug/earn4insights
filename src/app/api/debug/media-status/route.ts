import { NextResponse } from 'next/server'
import { db } from '@/db'
import { feedbackMedia } from '@/db/schema'
import { desc } from 'drizzle-orm'

/**
 * Temporary diagnostic endpoint to check feedback_media status.
 * DELETE THIS after debugging.
 * 
 * GET /api/debug/media-status
 */
export async function GET() {
  try {
    const rows = await db
      .select({
        id: feedbackMedia.id,
        ownerType: feedbackMedia.ownerType,
        ownerId: feedbackMedia.ownerId,
        mediaType: feedbackMedia.mediaType,
        status: feedbackMedia.status,
        errorCode: feedbackMedia.errorCode,
        errorDetail: feedbackMedia.errorDetail,
        retryCount: feedbackMedia.retryCount,
        lastErrorAt: feedbackMedia.lastErrorAt,
        lastAttemptAt: feedbackMedia.lastAttemptAt,
        createdAt: feedbackMedia.createdAt,
        updatedAt: feedbackMedia.updatedAt,
      })
      .from(feedbackMedia)
      .orderBy(desc(feedbackMedia.updatedAt))
      .limit(10)

    return NextResponse.json({
      count: rows.length,
      rows,
      hasOpenAIKey: !!process.env.OPENAI_API_KEY,
      openAIKeyPrefix: process.env.OPENAI_API_KEY?.slice(0, 7) ?? null,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
