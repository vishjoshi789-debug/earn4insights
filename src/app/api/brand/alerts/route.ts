/**
 * Brand Alerts API — Phase 1B
 *
 * GET   /api/brand/alerts            — Get alerts (paginated, filterable)
 * PATCH /api/brand/alerts?id=xxx     — Mark alert as read
 * POST  /api/brand/alerts?action=... — Mark all read
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { getBrandAlerts, getUnreadAlertCount, markAlertRead, markAllAlertsRead } from '@/server/brandAlertService'

export async function GET(req: NextRequest) {
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

    const { searchParams } = req.nextUrl
    const countOnly = searchParams.get('countOnly')

    // Quick unread count for badge
    if (countOnly === 'true') {
      const unread = await getUnreadAlertCount(userId)
      return NextResponse.json({ unread })
    }

    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)
    const offset = parseInt(searchParams.get('offset') || '0')
    const alertType = searchParams.get('alertType') || undefined
    const status = searchParams.get('status') || undefined

    const alerts = await getBrandAlerts(userId, { limit, offset, alertType, status })
    const unread = await getUnreadAlertCount(userId)

    return NextResponse.json({ alerts, unread, limit, offset })
  } catch (error) {
    console.error('[BrandAlerts GET] Error:', error)
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

    const alertId = req.nextUrl.searchParams.get('id')
    if (!alertId) {
      return NextResponse.json({ error: 'Alert id is required' }, { status: 400 })
    }

    const updated = await markAlertRead(alertId, userId)
    if (!updated) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json({ alert: updated })
  } catch (error) {
    console.error('[BrandAlerts PATCH] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
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

    if (body.action === 'mark_all_read') {
      await markAllAlertsRead(userId)
      return NextResponse.json({ message: 'All alerts marked as read' })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error) {
    console.error('[BrandAlerts POST] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
