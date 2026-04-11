/**
 * Admin Approve Content
 * POST /api/admin/content/[id]/approve
 *
 * Admin approves any pending_review post (campaign or non-campaign).
 * Bypasses campaign ownership check. Logs to audit_log.
 *
 * Access: authenticated admin users
 *
 * TODO: Admin UI planned for future sprint
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
    if (!userId || role !== 'admin') {
      return NextResponse.json({ error: 'Admin access only' }, { status: 403 })
    }

    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: 'Post ID required' }, { status: 400 })
    }

    const result = await approveContent(id, userId, 'admin')

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ success: true, post: result.post })
  } catch (error) {
    console.error('[AdminApprove POST]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
