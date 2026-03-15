/**
 * User Notification Settings API (all roles)
 *
 * GET  /api/user/notification-settings  — Get WhatsApp phone + enabled flag
 * PATCH /api/user/notification-settings — Save phone number + enable/disable WhatsApp
 *
 * Available to both brands and consumers — every user can configure
 * their WhatsApp notification preferences.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import {
  getUserProfile,
  updateNotificationPreferences,
} from '@/db/repositories/userProfileRepository'

export async function GET(_req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const profile = await getUserProfile(userId)
    const prefs = (profile?.notificationPreferences as any) || {}
    const waPrefs = prefs?.whatsapp || {}

    return NextResponse.json({
      whatsappEnabled: waPrefs.enabled ?? false,
      whatsappPhoneNumber: waPrefs.phoneNumber || null,
    })
  } catch (error) {
    console.error('[UserNotificationSettings GET] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { whatsappEnabled, whatsappPhoneNumber } = body

    // Validate phone number — must be in E.164 format (+<country_code><number>) or empty
    const trimmedPhone = (whatsappPhoneNumber || '').trim()
    if (trimmedPhone && !/^\+[1-9]\d{6,14}$/.test(trimmedPhone)) {
      return NextResponse.json(
        {
          error:
            'Invalid phone number. Use international E.164 format, e.g. +14155552671',
        },
        { status: 400 },
      )
    }

    const profile = await getUserProfile(userId)
    const existing = (profile?.notificationPreferences as any) || {}

    const updated = await updateNotificationPreferences(userId, {
      ...existing,
      whatsapp: {
        ...(existing?.whatsapp || {}),
        enabled: typeof whatsappEnabled === 'boolean' ? whatsappEnabled : (existing?.whatsapp?.enabled ?? false),
        phoneNumber: trimmedPhone || null,
      },
    })

    if (!updated) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[UserNotificationSettings PATCH] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
