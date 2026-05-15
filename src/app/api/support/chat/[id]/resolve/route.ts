import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { validateCsrfToken, csrfErrorResponse } from '@/lib/csrf'
import { supportReadRateLimit } from '@/lib/rate-limit-upstash'
import { resolveConversation } from '@/server/chatbotService'

/**
 * POST /api/support/chat/[id]/resolve
 * User marks an active conversation as resolved (e.g. clicked "Yes, that helped").
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

    const rl = await supportReadRateLimit.limit(userId)
    if (!rl.success) {
      return NextResponse.json({ error: 'Too many requests.' }, { status: 429 })
    }

    const { id } = await params
    if (!id) return NextResponse.json({ error: 'Conversation id required' }, { status: 400 })

    const conversation = await resolveConversation({ conversationId: id, userId })
    return NextResponse.json({ conversation })
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === 'Conversation not found')
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
      if (err.message === 'Forbidden')
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    console.error('[support/chat/[id]/resolve POST] error:', err)
    return NextResponse.json({ error: 'Failed to resolve conversation' }, { status: 500 })
  }
}
