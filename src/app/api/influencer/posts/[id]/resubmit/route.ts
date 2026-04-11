/**
 * Resubmit Rejected Post
 * POST /api/influencer/posts/[id]/resubmit
 *
 * Edit a rejected post and resubmit for review.
 * Body: { title?: string, body?: string, mediaUrls?: string[] }
 *
 * Access: authenticated users with isInfluencer=true
 */

import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { db } from '@/db'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { resubmitContent } from '@/server/contentApprovalService'

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
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await db.query.users.findFirst({ where: eq(users.id, userId) })
    if (!user?.isInfluencer) {
      return NextResponse.json({ error: 'Influencer access only' }, { status: 403 })
    }

    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: 'Post ID required' }, { status: 400 })
    }

    const body = await req.json().catch(() => ({}))
    const updates: { title?: string; body?: string; mediaUrls?: string[] } = {}
    if (body.title && typeof body.title === 'string') updates.title = body.title
    if (body.body && typeof body.body === 'string') updates.body = body.body
    if (Array.isArray(body.mediaUrls)) updates.mediaUrls = body.mediaUrls

    const result = await resubmitContent(id, userId, updates)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ success: true, post: result.post })
  } catch (error) {
    console.error('[Resubmit POST]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
