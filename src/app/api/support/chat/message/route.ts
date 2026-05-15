import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { validateCsrfToken, csrfErrorResponse } from '@/lib/csrf'
import { supportChatMessageRateLimit } from '@/lib/rate-limit-upstash'
import { sendMessage } from '@/server/chatbotService'

/**
 * POST /api/support/chat/message
 * Body: { conversationId, message }
 * Returns the bot's reply + outcome metadata (faq/ai/flagged/blocked).
 */
export async function POST(req: NextRequest) {
  if (!validateCsrfToken(req)) return csrfErrorResponse()
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = (session.user as any).id as string

    const rl = await supportChatMessageRateLimit.limit(userId)
    if (!rl.success) {
      return NextResponse.json(
        { error: "You're sending messages a bit fast. Please wait a moment." },
        { status: 429 }
      )
    }

    const body = await req.json().catch(() => null)
    const conversationId = body && typeof body.conversationId === 'string' ? body.conversationId : ''
    const message = body && typeof body.message === 'string' ? body.message.trim() : ''
    if (!conversationId) return NextResponse.json({ error: 'conversationId required' }, { status: 400 })
    if (!message) return NextResponse.json({ error: 'message required' }, { status: 400 })
    if (message.length > 4000) {
      return NextResponse.json({ error: 'Message too long (max 4,000 chars)' }, { status: 400 })
    }

    const outcome = await sendMessage({ conversationId, userId, message })
    return NextResponse.json(outcome)
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === 'Conversation not found')
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
      if (err.message === 'Forbidden')
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      if (err.message === 'Conversation is closed')
        return NextResponse.json({ error: 'This chat has ended. Start a new one.' }, { status: 409 })
    }
    console.error('[support/chat/message POST] error:', err)
    return NextResponse.json({ error: 'Failed to process message' }, { status: 500 })
  }
}
