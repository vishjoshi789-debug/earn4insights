/**
 * Admin Pending Content
 * GET /api/admin/content/pending
 *
 * Returns all pending_review posts that are NOT linked to a campaign
 * (platform content requiring admin review).
 *
 * Access: authenticated admin users
 *
 * TODO: Admin UI planned for future sprint
 */

import 'server-only'

import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { getPendingPostsForAdmin } from '@/db/repositories/contentApprovalRepository'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const role = (session.user as any).role
    if (role !== 'admin') {
      return NextResponse.json({ error: 'Admin access only' }, { status: 403 })
    }

    const posts = await getPendingPostsForAdmin()

    return NextResponse.json({ posts, total: posts.length })
  } catch (error) {
    console.error('[AdminPendingContent GET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
