import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { supportAdminRateLimit } from '@/lib/rate-limit-upstash'
import { getAdminTicketQueue } from '@/server/supportService'
import type { SupportTicket } from '@/db/schema'

const VALID_CATEGORIES: ReadonlyArray<SupportTicket['category']> = [
  'account', 'payment', 'campaign', 'feedback', 'technical', 'billing',
  'feature_request', 'bug_report', 'influencer', 'deals', 'community',
  'competitive_intel', 'other',
]
const VALID_STATUSES: ReadonlyArray<SupportTicket['status']> = [
  'open', 'in_progress', 'waiting_on_user', 'resolved', 'closed',
]
const VALID_PRIORITIES: ReadonlyArray<SupportTicket['priority']> = [
  'low', 'medium', 'high', 'urgent',
]

/**
 * GET /api/admin/support/tickets
 * Admin-only queue ordered urgent → high → medium → low, then oldest first.
 * Filters: ?status, ?category, ?priority, ?limit, ?offset.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = (session.user as any).id as string
    const role = (session.user as any).role as string
    if (role !== 'admin') return NextResponse.json({ error: 'Admin access only' }, { status: 403 })

    const rl = await supportAdminRateLimit.limit(userId)
    if (!rl.success) {
      return NextResponse.json({ error: 'Too many requests.' }, { status: 429 })
    }

    const sp = req.nextUrl.searchParams
    const status = sp.get('status') as SupportTicket['status'] | null
    const category = sp.get('category') as SupportTicket['category'] | null
    const priority = sp.get('priority') as SupportTicket['priority'] | null
    const limit = Math.min(200, Math.max(1, parseInt(sp.get('limit') || '50')))
    const offset = Math.max(0, parseInt(sp.get('offset') || '0'))

    const tickets = await getAdminTicketQueue(
      {
        status: status && VALID_STATUSES.includes(status) ? status : undefined,
        category: category && VALID_CATEGORIES.includes(category) ? category : undefined,
        priority: priority && VALID_PRIORITIES.includes(priority) ? priority : undefined,
      },
      { limit, offset }
    )

    return NextResponse.json({ tickets, pagination: { limit, offset, count: tickets.length } })
  } catch (err) {
    console.error('[admin/support/tickets GET] error:', err)
    return NextResponse.json({ error: 'Failed to list tickets' }, { status: 500 })
  }
}
