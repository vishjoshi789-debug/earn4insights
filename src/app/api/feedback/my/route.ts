import { NextResponse } from 'next/server'
import { db } from '@/db'
import { feedback, products } from '@/db/schema'
import { eq, desc, sql } from 'drizzle-orm'
import { auth } from '@/lib/auth/auth.config'

/**
 * GET /api/feedback/my
 *
 * Fetch all feedback submitted by the currently logged-in user.
 *
 * ── MATCHES ON user_id, NEVER ON user_email ────────────────────────────────
 * This previously matched `feedback.user_email = session.user.email`, which
 * was a LIVE mis-attribution bug, not merely a fragile join:
 *
 *   `api/import/csv` used to fall back to `session.user.email` when a CSV had
 *   no email column, so in production all 18 imported rows carry the IMPORTING
 *   BRAND's address. That brand's "My Feedback" page therefore listed 18
 *   pieces of third-party consumers' feedback as its own — other people's
 *   words, ratings and sentiment, presented as theirs.
 *
 * `user_id` (migration 033) is the only trustworthy identity here: it is set
 * from the session on submit and left NULL for imported rows precisely because
 * those respondents are not platform users. Rows with a NULL user_id belong to
 * nobody's "My Feedback" and must never be matched by any fallback.
 *
 * This is also the destination of the resolution-loop notification, so a wrong
 * match here would send a consumer to a page showing someone else's feedback.
 */
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id

    // Fetch feedback with product name via left join
    const results = await db
      .select({
        id: feedback.id,
        productId: feedback.productId,
        productName: products.name,
        feedbackText: feedback.feedbackText,
        rating: feedback.rating,
        sentiment: feedback.sentiment,
        category: feedback.category,
        status: feedback.status,
        createdAt: feedback.createdAt,
        modalityPrimary: feedback.modalityPrimary,
        originalLanguage: feedback.originalLanguage,
      })
      .from(feedback)
      .leftJoin(products, eq(feedback.productId, products.id))
      .where(eq(feedback.userId, userId))
      .orderBy(desc(feedback.createdAt))
      .limit(100)

    // Also get summary stats
    const statsResult = await db
      .select({
        totalCount: sql<number>`count(*)`,
        avgRating: sql<number>`round(avg(${feedback.rating})::numeric, 1)`,
        positiveCount: sql<number>`count(*) filter (where ${feedback.sentiment} = 'positive')`,
        neutralCount: sql<number>`count(*) filter (where ${feedback.sentiment} = 'neutral')`,
        negativeCount: sql<number>`count(*) filter (where ${feedback.sentiment} = 'negative')`,
      })
      .from(feedback)
      .where(eq(feedback.userId, userId))

    const stats = statsResult[0] || {
      totalCount: 0,
      avgRating: null,
      positiveCount: 0,
      neutralCount: 0,
      negativeCount: 0,
    }

    return NextResponse.json({
      feedback: results,
      stats: {
        totalCount: Number(stats.totalCount),
        avgRating: stats.avgRating ? Number(stats.avgRating) : null,
        positiveCount: Number(stats.positiveCount),
        neutralCount: Number(stats.neutralCount),
        negativeCount: Number(stats.negativeCount),
      },
    })
  } catch (error) {
    console.error('My feedback fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch feedback' },
      { status: 500 }
    )
  }
}
