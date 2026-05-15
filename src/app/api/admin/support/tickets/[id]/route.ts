import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { validateCsrfToken, csrfErrorResponse } from '@/lib/csrf'
import { supportAdminRateLimit } from '@/lib/rate-limit-upstash'
import {
  getTicketDetail,
  updateTicketStatus,
  assignTicket,
} from '@/server/supportService'
import { updateTicket } from '@/db/repositories/supportRepository'
import { db } from '@/db'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'
import type { SupportTicket } from '@/db/schema'

const VALID_STATUSES: ReadonlyArray<SupportTicket['status']> = [
  'open', 'in_progress', 'waiting_on_user', 'resolved', 'closed',
]
const VALID_PRIORITIES: ReadonlyArray<SupportTicket['priority']> = [
  'low', 'medium', 'high', 'urgent',
]
const VALID_CATEGORIES: ReadonlyArray<SupportTicket['category']> = [
  'account', 'payment', 'campaign', 'feedback', 'technical', 'billing',
  'feature_request', 'bug_report', 'influencer', 'deals', 'community',
  'competitive_intel', 'other',
]

/**
 * GET /api/admin/support/tickets/[id]
 * Admin view of a ticket — includes internal notes.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params
    if (!id) return NextResponse.json({ error: 'Ticket id required' }, { status: 400 })

    const detail = await getTicketDetail(id, { userId, isAdmin: true })
    if (!detail) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(detail)
  } catch (err) {
    console.error('[admin/support/tickets/[id] GET] error:', err)
    return NextResponse.json({ error: 'Failed to load ticket' }, { status: 500 })
  }
}

/**
 * PUT /api/admin/support/tickets/[id]
 * Admin updates status and/or assignment.
 * Body: { status?, resolutionNotes?, assignedTo?: string|null }
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!validateCsrfToken(req)) return csrfErrorResponse()
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const adminId = (session.user as any).id as string
    const role = (session.user as any).role as string
    if (role !== 'admin') return NextResponse.json({ error: 'Admin access only' }, { status: 403 })

    const rl = await supportAdminRateLimit.limit(adminId)
    if (!rl.success) {
      return NextResponse.json({ error: 'Too many requests.' }, { status: 429 })
    }

    const { id } = await params
    if (!id) return NextResponse.json({ error: 'Ticket id required' }, { status: 400 })

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    // Status update path
    if (typeof body.status === 'string') {
      const status = body.status as SupportTicket['status']
      if (!VALID_STATUSES.includes(status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
      }
      const resolutionNotes = typeof body.resolutionNotes === 'string'
        ? body.resolutionNotes.trim().slice(0, 5000) || undefined
        : undefined

      // Need the user's name for the resolution email.
      const detail = await getTicketDetail(id, { userId: adminId, isAdmin: true })
      if (!detail) return NextResponse.json({ error: 'Not found' }, { status: 404 })

      const [u] = await db.select({ name: users.name }).from(users).where(eq(users.id, detail.ticket.userId)).limit(1)
      const ticket = await updateTicketStatus(
        { ticketId: id, adminId, status, resolutionNotes },
        { userName: u?.name ?? '' }
      )
      return NextResponse.json({ ticket })
    }

    // Assignment path (assignedTo can be null to unassign)
    if (body.assignedTo !== undefined) {
      const assignedTo: string | null = body.assignedTo === null ? null : String(body.assignedTo)
      const ticket = await assignTicket(id, assignedTo)
      return NextResponse.json({ ticket })
    }

    // Priority + category triage path (no email side-effect)
    const triage: { priority?: SupportTicket['priority']; category?: SupportTicket['category'] } = {}
    if (typeof body.priority === 'string') {
      if (!VALID_PRIORITIES.includes(body.priority as SupportTicket['priority'])) {
        return NextResponse.json({ error: 'Invalid priority' }, { status: 400 })
      }
      triage.priority = body.priority as SupportTicket['priority']
    }
    if (typeof body.category === 'string') {
      if (!VALID_CATEGORIES.includes(body.category as SupportTicket['category'])) {
        return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
      }
      triage.category = body.category as SupportTicket['category']
    }
    if (triage.priority || triage.category) {
      const ticket = await updateTicket(id, triage)
      return NextResponse.json({ ticket })
    }

    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  } catch (err) {
    if (err instanceof Error && err.message === 'Ticket not found') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    console.error('[admin/support/tickets/[id] PUT] error:', err)
    return NextResponse.json({ error: 'Failed to update ticket' }, { status: 500 })
  }
}
