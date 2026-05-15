import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { supportReadRateLimit } from '@/lib/rate-limit-upstash'
import { getTicketDetail } from '@/server/supportService'

/**
 * GET /api/support/tickets/[id]
 * Returns the ticket + message thread.
 * Users see only their own tickets; admins see any (but admin-side UI
 * uses /api/admin/support/tickets/[id] for the richer view with internal notes).
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

    const rl = await supportReadRateLimit.limit(userId)
    if (!rl.success) {
      return NextResponse.json({ error: 'Too many requests.' }, { status: 429 })
    }

    const { id } = await params
    if (!id) return NextResponse.json({ error: 'Ticket id required' }, { status: 400 })

    const detail = await getTicketDetail(id, { userId, isAdmin: false })
    // role=admin uses the dedicated admin route; this user route always treats requester as non-admin.
    // (Keeps the user surface simple and prevents accidental internal-note leakage.)
    void role
    if (!detail) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json(detail)
  } catch (err) {
    console.error('[support/tickets/[id] GET] error:', err)
    return NextResponse.json({ error: 'Failed to load ticket' }, { status: 500 })
  }
}
