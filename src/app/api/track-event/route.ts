import { auth } from '@/lib/auth/auth.config'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { userEvents } from '@/db/schema'

/**
 * Client-side event tracking endpoint
 * Allows tracking of user interactions like recommendation views/clicks
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { eventType, productId, surveyId, metadata } = await request.json()

    if (!eventType) {
      return NextResponse.json(
        { error: 'eventType is required' },
        { status: 400 }
      )
    }

    // Insert event (follows schema from eventTrackingService)
    await db.insert(userEvents).values({
      userId: session.user.id,
      eventType,
      productId: productId || null,
      surveyId: surveyId || null,
      metadata: metadata || {},
      schemaVersion: 1
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Track Event] Error:', error)
    return NextResponse.json(
      { error: 'Failed to track event' },
      { status: 500 }
    )
  }
}
