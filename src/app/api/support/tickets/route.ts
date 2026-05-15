import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { validateCsrfToken, csrfErrorResponse } from '@/lib/csrf'
import {
  supportTicketCreateRateLimit,
  supportReadRateLimit,
} from '@/lib/rate-limit-upstash'
import { createTicket, getUserTickets } from '@/server/supportService'
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
 * GET /api/support/tickets
 * List the current user's tickets. Supports ?status=, ?category=, ?priority=, ?limit, ?offset.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = (session.user as any).id as string

    const rl = await supportReadRateLimit.limit(userId)
    if (!rl.success) {
      return NextResponse.json({ error: 'Too many requests.' }, { status: 429 })
    }

    const sp = req.nextUrl.searchParams
    const status = sp.get('status') as SupportTicket['status'] | null
    const category = sp.get('category') as SupportTicket['category'] | null
    const priority = sp.get('priority') as SupportTicket['priority'] | null
    const limit = Math.min(100, Math.max(1, parseInt(sp.get('limit') || '20')))
    const offset = Math.max(0, parseInt(sp.get('offset') || '0'))

    const tickets = await getUserTickets(
      userId,
      {
        status: status && VALID_STATUSES.includes(status) ? status : undefined,
        category: category && VALID_CATEGORIES.includes(category) ? category : undefined,
        priority: priority && VALID_PRIORITIES.includes(priority) ? priority : undefined,
      },
      { limit, offset }
    )

    return NextResponse.json({ tickets, pagination: { limit, offset, count: tickets.length } })
  } catch (err) {
    console.error('[support/tickets GET] error:', err)
    return NextResponse.json({ error: 'Failed to list tickets' }, { status: 500 })
  }
}

/**
 * POST /api/support/tickets
 * Create a new ticket. Body: { category, subject, description }.
 */
export async function POST(req: NextRequest) {
  if (!validateCsrfToken(req)) return csrfErrorResponse()
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = (session.user as any).id as string
    const role = (session.user as any).role as string
    const userEmail = session.user.email
    const userName = session.user.name ?? ''

    const rl = await supportTicketCreateRateLimit.limit(userId)
    if (!rl.success) {
      return NextResponse.json(
        { error: 'You can create up to 5 tickets per hour. Please wait before opening another.' },
        { status: 429 }
      )
    }

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const category = body.category as SupportTicket['category']
    const subject = typeof body.subject === 'string' ? body.subject.trim() : ''
    const description = typeof body.description === 'string' ? body.description.trim() : ''

    if (!category || !VALID_CATEGORIES.includes(category)) {
      return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
    }
    if (!subject || subject.length > 200) {
      return NextResponse.json(
        { error: 'Subject is required and must be under 200 characters' },
        { status: 400 }
      )
    }
    if (!description || description.length > 5000) {
      return NextResponse.json(
        { error: 'Description is required and must be under 5,000 characters' },
        { status: 400 }
      )
    }

    const ticket = await createTicket({
      userId,
      userEmail,
      userRole: role,
      userName,
      category,
      subject,
      description,
    })

    return NextResponse.json({ ticket }, { status: 201 })
  } catch (err) {
    console.error('[support/tickets POST] error:', err)
    return NextResponse.json({ error: 'Failed to create ticket' }, { status: 500 })
  }
}
