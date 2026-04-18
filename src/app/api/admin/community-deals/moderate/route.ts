/**
 * POST /api/admin/community-deals/moderate
 *
 * Approve or reject community posts (single or bulk). Admin only.
 * Body: { postIds: string[], action: 'approve' | 'reject', reason?: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { approvePost, rejectPost, bulkModerate } from '@/server/dealsModerationService'

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const user = session.user as any
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access only' }, { status: 403 })
    }

    const body = await req.json().catch(() => null)
    if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

    const { postIds, action, reason } = body

    if (!action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'action must be "approve" or "reject"' }, { status: 400 })
    }

    // Single post
    if (!postIds && body.postId) {
      if (action === 'approve') {
        const post = await approvePost(body.postId, user.id)
        return NextResponse.json({ post })
      } else {
        if (!reason) return NextResponse.json({ error: 'reason is required for rejection' }, { status: 400 })
        const post = await rejectPost(body.postId, user.id, reason)
        return NextResponse.json({ post })
      }
    }

    // Bulk
    if (!Array.isArray(postIds) || postIds.length === 0) {
      return NextResponse.json({ error: 'postIds array is required' }, { status: 400 })
    }
    if (postIds.length > 50) {
      return NextResponse.json({ error: 'Maximum 50 posts per batch' }, { status: 400 })
    }

    const results = await bulkModerate(postIds, action, user.id, reason)
    return NextResponse.json({ results })
  } catch (error) {
    console.error('[AdminModerate POST]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
