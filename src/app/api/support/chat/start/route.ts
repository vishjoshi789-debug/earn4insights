import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { validateCsrfToken, csrfErrorResponse } from '@/lib/csrf'
import { supportChatStartRateLimit } from '@/lib/rate-limit-upstash'
import { startConversation } from '@/server/chatbotService'
import type { ChatbotRole } from '@/server/chatbot-knowledge-base'

const VALID_ROLES: ReadonlyArray<ChatbotRole> = ['brand', 'consumer', 'influencer']

/**
 * POST /api/support/chat/start
 * Body (optional): { currentPage, recentActions: string[] }
 * Returns the conversation row + greeting + role-specific quick actions.
 */
export async function POST(req: NextRequest) {
  if (!validateCsrfToken(req)) return csrfErrorResponse()
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = (session.user as any).id as string
    const sessionRole = (session.user as any).role as string
    const isInfluencer = (session.user as any).isInfluencer === true

    // Chatbot role: brand stays brand; consumers who are also influencers
    // can switch to the influencer experience via ?role=influencer.
    const body = await req.json().catch(() => ({}))
    const requestedRole = body?.role as ChatbotRole | undefined
    let chatRole: ChatbotRole
    if (sessionRole === 'brand') chatRole = 'brand'
    else if (requestedRole === 'influencer' && isInfluencer) chatRole = 'influencer'
    else if (requestedRole && VALID_ROLES.includes(requestedRole)) chatRole = requestedRole
    else chatRole = 'consumer'

    const rl = await supportChatStartRateLimit.limit(userId)
    if (!rl.success) {
      return NextResponse.json({ error: 'Slow down — too many chat starts.' }, { status: 429 })
    }

    const currentPage = typeof body?.currentPage === 'string' ? body.currentPage.slice(0, 200) : null
    const recentActions = Array.isArray(body?.recentActions)
      ? (body.recentActions as unknown[])
          .filter((a): a is string => typeof a === 'string')
          .slice(-5)
          .map((s) => s.slice(0, 100))
      : null

    const out = await startConversation({
      userId,
      userRole: chatRole,
      context: { currentPage, recentActions },
    })

    return NextResponse.json({
      conversationId: out.conversation.id,
      greeting: out.greeting,
      quickActions: out.quickActions,
    }, { status: 201 })
  } catch (err) {
    console.error('[support/chat/start POST] error:', err)
    return NextResponse.json({ error: 'Failed to start chat' }, { status: 500 })
  }
}
