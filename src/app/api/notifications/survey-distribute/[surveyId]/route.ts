import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { db } from '@/db'
import { surveys, products } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { notifyIdealConsumers } from '@/lib/personalization/smartDistributionService'

/**
 * POST /api/notifications/survey-distribute/[surveyId]
 *
 * Triggered after a brand creates/activates a survey.
 * Finds ideal consumers for the survey's product and notifies them.
 *
 * Auth: brand owner of the product only
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ surveyId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { surveyId } = await params

    // Lookup the survey
    const [survey] = await db
      .select({
        id: surveys.id,
        productId: surveys.productId,
        title: surveys.title,
        status: surveys.status,
      })
      .from(surveys)
      .where(eq(surveys.id, surveyId))
      .limit(1)

    if (!survey) {
      return NextResponse.json({ error: 'Survey not found' }, { status: 404 })
    }

    // Verify the caller owns the product this survey belongs to
    const [product] = await db
      .select({ id: products.id, ownerId: products.ownerId, name: products.name })
      .from(products)
      .where(eq(products.id, survey.productId))
      .limit(1)

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    if (product.ownerId !== session.user.id) {
      return NextResponse.json({ error: 'Not your product' }, { status: 403 })
    }

    // Find ideal consumers & notify about the new survey
    const result = await notifyIdealConsumers(survey.productId, 'new_survey', {
      surveyId: survey.id,
      surveyTitle: survey.title,
      maxNotifications: 50,
    })

    return NextResponse.json({
      success: true,
      notified: result.notified,
      topScores: result.topScores,
      message: `Notified ${result.notified} ideal consumers about survey "${survey.title}" for "${product.name}"`,
    })
  } catch (error) {
    console.error('[SurveyDistribute] Error:', error)
    return NextResponse.json(
      { error: 'Failed to distribute survey notifications' },
      { status: 500 }
    )
  }
}
