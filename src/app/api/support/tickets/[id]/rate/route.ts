import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { validateCsrfToken, csrfErrorResponse } from '@/lib/csrf'
import { supportReadRateLimit } from '@/lib/rate-limit-upstash'
import { rateTicket } from '@/server/supportService'

/**
 * POST /api/support/tickets/[id]/rate
 * Body: { rating: 1..5, feedback?: string }
 * Only the ticket owner can rate; only after status is resolved/closed.
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
    if (!id) return NextResponse.json({ error: 'Ticket id required' }, { status: 400 })

    const body = await req.json().catch(() => null)
    const rating = body && typeof body.rating === 'number' ? body.rating : 0
    const feedback = body && typeof body.feedback === 'string'
      ? body.feedback.trim().slice(0, 2000) || undefined
      : undefined

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Rating must be 1..5' }, { status: 400 })
    }

    const ticket = await rateTicket({ ticketId: id, userId, rating, feedback })
    return NextResponse.json({ ticket })
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === 'Ticket not found') return NextResponse.json({ error: 'Not found' }, { status: 404 })
      if (err.message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      if (err.message === 'Ticket must be resolved before rating') {
        return NextResponse.json({ error: err.message }, { status: 400 })
      }
    }
    console.error('[support/tickets/[id]/rate POST] error:', err)
    return NextResponse.json({ error: 'Failed to rate ticket' }, { status: 500 })
  }
}
