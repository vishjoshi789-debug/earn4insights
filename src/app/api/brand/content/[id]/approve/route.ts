/**
 * Brand Approve Content
 * POST /api/brand/content/[id]/approve
 *
 * Brand approves a pending_review post linked to their campaign.
 * Validates brand owns the campaign. Logs to audit_log.
 *
 * Access: authenticated brand users
 */

import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { approveContent } from '@/server/contentApprovalService'

export async function POST(
  _req: NextRequest,
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

    const result = await approveContent(id, userId, 'brand')

    if (!result.success) {
      const status = result.error === 'You do not own this campaign' ? 403 : 400
      return NextResponse.json({ error: result.error }, { status })
    }

    return NextResponse.json({ success: true, post: result.post })
  } catch (error) {
    console.error('[BrandApprove POST]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
