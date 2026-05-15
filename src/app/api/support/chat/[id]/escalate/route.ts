import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { validateCsrfToken, csrfErrorResponse } from '@/lib/csrf'
import { supportTicketCreateRateLimit } from '@/lib/rate-limit-upstash'
import { escalateToTicket } from '@/server/chatbotService'

/**
 * POST /api/support/chat/[id]/escalate
 * Promote an active chat into a support ticket. The bot classifies the
 * conversation into a category and writes the ticket subject + description.
 * Subject to the same hourly create cap as direct ticket creation.
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

    const rl = await supportTicketCreateRateLimit.limit(userId)
    if (!rl.success) {
      return NextResponse.json(
        { error: 'You can create up to 5 tickets per hour.' },
        { status: 429 }
      )
    }

    const { id } = await params
    if (!id) return NextResponse.json({ error: 'Conversation id required' }, { status: 400 })

    const ticket = await escalateToTicket({ conversationId: id, userId })
    return NextResponse.json({ ticket }, { status: 201 })
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === 'Conversation not found')
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
      if (err.message === 'Forbidden')
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      if (err.message === 'Conversation is blocked')
        return NextResponse.json({ error: 'This conversation cannot be escalated.' }, { status: 409 })
      if (err.message === 'Conversation already escalated')
        return NextResponse.json({ error: 'This conversation is already escalated.' }, { status: 409 })
    }
    console.error('[support/chat/[id]/escalate POST] error:', err)
    return NextResponse.json({ error: 'Failed to escalate' }, { status: 500 })
  }
}
