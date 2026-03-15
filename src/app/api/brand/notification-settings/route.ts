/**
 * Brand Notification Settings API
 *
 * GET  /api/brand/notification-settings  — Get brand's Slack webhook URL + prefs
 * PATCH /api/brand/notification-settings — Save Slack webhook URL
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
    const role = (session.user as any).role
    if (!userId || role !== 'brand') {
      return NextResponse.json({ error: 'Brand access only' }, { status: 403 })
    }

    const profile = await getUserProfile(userId)
    const prefs = (profile?.notificationPreferences as any) || {}
    const slackWebhookUrl = prefs?.slack?.webhookUrl || null

    return NextResponse.json({ slackWebhookUrl, prefs })
  } catch (error) {
    console.error('[NotificationSettings GET] Error:', error)
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
    const role = (session.user as any).role
    if (!userId || role !== 'brand') {
      return NextResponse.json({ error: 'Brand access only' }, { status: 403 })
    }

    const body = await req.json()
    const { slackWebhookUrl } = body

    // Validate webhook URL — must be a Slack URL or empty string
    if (slackWebhookUrl && !slackWebhookUrl.startsWith('https://hooks.slack.com/')) {
      return NextResponse.json(
        { error: 'Invalid Slack webhook URL. Must start with https://hooks.slack.com/' },
        { status: 400 },
      )
    }

    // Merge into existing notification preferences
    const profile = await getUserProfile(userId)
    const existing = (profile?.notificationPreferences as any) || {}

    const updated = await updateNotificationPreferences(userId, {
      ...existing,
      slack: {
        ...(existing?.slack || {}),
        webhookUrl: slackWebhookUrl || null,
      },
    })

    if (!updated) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[NotificationSettings PATCH] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
