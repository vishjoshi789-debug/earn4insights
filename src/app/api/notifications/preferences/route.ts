import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import {
  getAllPreferences,
  upsertPreference,
  isNotifiableEventType,
  type NotifiableEventType,
} from '@/db/repositories/notificationPreferenceRepository'

/**
 * GET /api/notifications/preferences
 *   All per-event-type notification preferences for the current user.
 *   Event types with no saved row are absent — the client applies the
 *   defaults (in-app ✓ / email ✓ / SMS ✗).
 *
 * POST /api/notifications/preferences
 *   Upsert one or many event types in a single request.
 *     { eventType: string,   inAppEnabled?, emailEnabled?, smsEnabled? }
 *     { eventTypes: string[], inAppEnabled?, emailEnabled?, smsEnabled? }
 *
 *   The array form exists because the settings UI groups ~40 event types into
 *   a handful of meaningful categories ("Campaigns & payouts"). Toggling a
 *   category must be ONE atomic-ish request, not eight racing ones that leave
 *   a category half-on if the tab closes midway.
 *
 * ⚠️ Until 2026-08-10 this API had NO caller anywhere in the app, so every
 * user sat on the defaults with no way to change them — enforced in
 * `dispatchToUser`, unreachable in the UI. Now called by
 * `NotificationPreferencesCard` on /dashboard/settings.
 *
 * Note: this table controls WHAT events to receive. HOW/WHEN to deliver
 * (channels, quiet hours) is the notificationPreferences JSONB on
 * userProfiles, managed by the same settings page.
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
    const { eventType, eventTypes, inAppEnabled, emailEnabled, smsEnabled } = body

    // Accept either shape, normalise to a list.
    const requested: unknown[] = Array.isArray(eventTypes)
      ? eventTypes
      : eventType !== undefined
        ? [eventType]
        : []

    if (requested.length === 0) {
      return NextResponse.json(
        { error: 'eventType or eventTypes is required' },
        { status: 400 }
      )
    }

    // VALIDATE against the known set. Previously any string was cast to
    // NotifiableEventType and written — a typo produced a permanent row that
    // getPreference would never match, so the user's choice silently did
    // nothing while the UI reported success. Reject the whole request rather
    // than partially applying it.
    const invalid = requested.filter(
      (t) => typeof t !== 'string' || !isNotifiableEventType(t)
    )
    if (invalid.length > 0) {
      return NextResponse.json(
        { error: `Unknown event type(s): ${invalid.join(', ')}` },
        { status: 400 }
      )
    }

    if (inAppEnabled === undefined && emailEnabled === undefined && smsEnabled === undefined) {
      return NextResponse.json(
        { error: 'At least one of inAppEnabled, emailEnabled, smsEnabled is required' },
        { status: 400 }
      )
    }

    const patch = {
      ...(inAppEnabled !== undefined && { inAppEnabled: Boolean(inAppEnabled) }),
      ...(emailEnabled !== undefined && { emailEnabled: Boolean(emailEnabled) }),
      ...(smsEnabled !== undefined && { smsEnabled: Boolean(smsEnabled) }),
    }

    const preferences = []
    for (const t of requested as NotifiableEventType[]) {
      preferences.push(await upsertPreference(userId, t, patch))
    }

    // `preference` (singular) retained for any caller using the old shape.
    return NextResponse.json({ preferences, preference: preferences[0] })
  } catch (error) {
    console.error('[POST /api/notifications/preferences]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
