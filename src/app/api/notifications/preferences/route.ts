import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import {
  getAllPreferences,
  upsertPreference,
  type NotifiableEventType,
} from '@/db/repositories/notificationPreferenceRepository'

/**
 * GET /api/notifications/preferences
 *   Returns all per-event-type notification preferences for the current user.
 *   For event types with no saved row, the client should apply defaults:
 *     inApp=true, email=true, sms=false
 *
 * POST /api/notifications/preferences
 *   Upsert a preference for one event type.
 *   Body: { eventType: string, inAppEnabled?: boolean, emailEnabled?: boolean, smsEnabled?: boolean }
 *
 * Note: This table controls WHAT events to receive (per event type).
 *       HOW/WHEN to deliver (channels, quiet hours) is controlled by the
 *       notificationPreferences JSONB on userProfiles — managed by /settings.
 */

export async function GET(_request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = (session.user as any).id as string

    const preferences = await getAllPreferences(userId)
    return NextResponse.json({ preferences })
  } catch (error) {
    console.error('[GET /api/notifications/preferences]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = (session.user as any).id as string

    const body = await request.json()
    const { eventType, inAppEnabled, emailEnabled, smsEnabled } = body

    if (!eventType || typeof eventType !== 'string') {
      return NextResponse.json({ error: 'eventType is required' }, { status: 400 })
    }

    // Validate at least one field is provided
    if (inAppEnabled === undefined && emailEnabled === undefined && smsEnabled === undefined) {
      return NextResponse.json(
        { error: 'At least one of inAppEnabled, emailEnabled, smsEnabled is required' },
        { status: 400 }
      )
    }

    const preference = await upsertPreference(
      userId,
      eventType as NotifiableEventType,
      {
        ...(inAppEnabled !== undefined && { inAppEnabled: Boolean(inAppEnabled) }),
        ...(emailEnabled !== undefined && { emailEnabled: Boolean(emailEnabled) }),
        ...(smsEnabled   !== undefined && { smsEnabled:   Boolean(smsEnabled) }),
      }
    )

    return NextResponse.json({ preference })
  } catch (error) {
    console.error('[POST /api/notifications/preferences]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
