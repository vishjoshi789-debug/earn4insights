import { NextResponse } from 'next/server'
import { db } from '@/db'
import { feedback, products } from '@/db/schema'
import { eq, desc, sql } from 'drizzle-orm'
import { auth } from '@/lib/auth/auth.config'

/**
 * GET /api/feedback/my
 * 
 * Fetch all feedback submitted by the currently logged-in user.
 * Matches by userEmail from session.
 */
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userEmail = session.user.email

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
      .where(eq(feedback.userEmail, userEmail))
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
      .where(eq(feedback.userEmail, userEmail))

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
