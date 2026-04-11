/**
 * Brand Reject Content
 * POST /api/brand/content/[id]/reject
 *
 * Brand rejects a pending_review post with a reason (min 10 chars).
 * Validates brand owns the campaign. Logs to audit_log.
 *
 * Body: { reason: string }
 *
 * Access: authenticated brand users
 */

import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { rejectContent } from '@/server/contentApprovalService'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const role = (session.user as any).role
    if (!userId || role !== 'brand') {
      return NextResponse.json({ error: 'Brand access only' }, { status: 403 })
    }

    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: 'Post ID required' }, { status: 400 })
    }

    const body = await req.json().catch(() => null)
    if (!body?.reason || typeof body.reason !== 'string') {
      return NextResponse.json({ error: 'reason is required (string)' }, { status: 400 })
    }

    const result = await rejectContent(id, userId, body.reason, 'brand')

    if (!result.success) {
      const status = result.error === 'You do not own this campaign' ? 403 : 400
      return NextResponse.json({ error: result.error }, { status })
    }

    return NextResponse.json({ success: true, post: result.post })
  } catch (error) {
    console.error('[BrandReject POST]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
