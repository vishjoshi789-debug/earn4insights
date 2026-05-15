import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { validateCsrfToken, csrfErrorResponse } from '@/lib/csrf'
import { supportAdminRateLimit } from '@/lib/rate-limit-upstash'
import { addTicketReply } from '@/server/supportService'

/**
 * POST /api/admin/support/tickets/[id]/reply
 * Admin posts a reply on a ticket.
 * Body: { message, isInternalNote?: boolean, attachments?: Array<{name,url,size}> }
 * Internal notes are hidden from the user and never emailed.
 */
export async function POST(
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
    const adminName = session.user.name ?? 'Earn4Insights Team'
    const role = (session.user as any).role as string
    if (role !== 'admin') return NextResponse.json({ error: 'Admin access only' }, { status: 403 })

    const rl = await supportAdminRateLimit.limit(adminId)
    if (!rl.success) {
      return NextResponse.json({ error: 'Too many requests.' }, { status: 429 })
    }

    const { id } = await params
    if (!id) return NextResponse.json({ error: 'Ticket id required' }, { status: 400 })

    const body = await req.json().catch(() => null)
    const message = body && typeof body.message === 'string' ? body.message.trim() : ''
    const isInternalNote = body && body.isInternalNote === true
    if (!message) return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    if (message.length > 10000) {
      return NextResponse.json({ error: 'Message too long (max 10,000 chars)' }, { status: 400 })
    }

    const attachments = Array.isArray(body?.attachments)
      ? body.attachments.slice(0, 10).filter((a: unknown) => {
          if (!a || typeof a !== 'object') return false
          const o = a as Record<string, unknown>
          return typeof o.name === 'string' && typeof o.url === 'string' && typeof o.size === 'number'
        })
      : []

    const result = await addTicketReply(
      {
        ticketId: id,
        senderUserId: adminId,
        senderRole: 'admin',
        message,
        attachments,
        isInternalNote,
      },
      { userName: adminName }
    )

    return NextResponse.json(result, { status: 201 })
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === 'Ticket not found') return NextResponse.json({ error: 'Not found' }, { status: 404 })
      if (err.message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    console.error('[admin/support/tickets/[id]/reply POST] error:', err)
    return NextResponse.json({ error: 'Failed to reply' }, { status: 500 })
  }
}
