/**
 * Influencer Audience Analytics API
 * GET /api/influencer/earnings/analytics
 *
 * Returns audience intelligence data aggregated from ICP-matched consumers.
 * Demographics are consent-gated (requires active 'demographic' consent).
 * Minimum cohort size: 5 (returns empty arrays if fewer matched).
 *
 * Access: authenticated users with isInfluencer=true
 */

import 'server-only'

import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { db } from '@/db'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { getAudienceAnalytics } from '@/server/influencerEarningsService'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    })
    if (!user?.isInfluencer) {
      return NextResponse.json({ error: 'Influencer access only' }, { status: 403 })
    }

    const analytics = await getAudienceAnalytics(userId)

    return NextResponse.json({
      ...analytics,
      note: 'Based on ICP-matched audience profile. Viewer-level tracking coming soon.',
      deviceNote: analytics.deviceBreakdown.length === 0
        ? 'Device breakdown requires viewer-level tracking (coming soon).'
        : undefined,
      peakHoursNote: analytics.peakHours.length === 0
        ? 'Peak hours require hour-level performance data (coming soon).'
        : undefined,
    })
  } catch (error) {
    console.error('[Influencer Analytics GET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
