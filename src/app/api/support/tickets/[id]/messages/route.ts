import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { validateCsrfToken, csrfErrorResponse } from '@/lib/csrf'
import { supportTicketReplyRateLimit } from '@/lib/rate-limit-upstash'
import { addTicketReply } from '@/server/supportService'

/**
 * POST /api/support/tickets/[id]/messages
 * User-side reply on their own ticket. Admin replies use the
 * dedicated /api/admin/support/tickets/[id]/reply route.
 *
 * Body: { message: string, attachments?: Array<{name,url,size}> }
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
    const userId = (session.user as any).id as string
    const userName = session.user.name ?? ''

    const rl = await supportTicketReplyRateLimit.limit(userId)
    if (!rl.success) {
      return NextResponse.json({ error: 'Too many replies. Please slow down.' }, { status: 429 })
    }

    const { id } = await params
    if (!id) return NextResponse.json({ error: 'Ticket id required' }, { status: 400 })

    const body = await req.json().catch(() => null)
    const message = body && typeof body.message === 'string' ? body.message.trim() : ''
    if (!message) return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    if (message.length > 5000) {
      return NextResponse.json({ error: 'Message too long (max 5,000 chars)' }, { status: 400 })
    }

    // Attachments are pass-through metadata only — no upload happens here.
    // The actual upload lives in the existing feedback-media upload pipeline.
    const attachments = Array.isArray(body.attachments)
      ? body.attachments.slice(0, 10).filter((a: unknown) => {
          if (!a || typeof a !== 'object') return false
          const o = a as Record<string, unknown>
          return typeof o.name === 'string' && typeof o.url === 'string' && typeof o.size === 'number'
        })
      : []

    const result = await addTicketReply(
      {
        ticketId: id,
        senderUserId: userId,
        senderRole: 'user',
        message,
        attachments,
        isInternalNote: false,
      },
      { userName }
    )

    return NextResponse.json(result, { status: 201 })
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === 'Ticket not found') return NextResponse.json({ error: 'Not found' }, { status: 404 })
      if (err.message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    console.error('[support/tickets/[id]/messages POST] error:', err)
    return NextResponse.json({ error: 'Failed to add reply' }, { status: 500 })
  }
}
