/**
 * Influencer Content Post Detail API
 *
 * GET    /api/influencer/content/[postId] — Get post details
 * PATCH  /api/influencer/content/[postId] — Update post
 * DELETE /api/influencer/content/[postId] — Delete post
 *
 * Access: authenticated influencer (own posts only)
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import {
  getPostById,
  updatePost,
  updatePostStatus,
  deletePost,
} from '@/db/repositories/influencerContentPostRepository'

type RouteParams = { params: Promise<{ postId: string }> }

async function getInfluencerUser(): Promise<{ userId: string } | NextResponse> {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return { userId: (session.user as any).id }
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await getInfluencerUser()
    if (authResult instanceof NextResponse) return authResult

    const { postId } = await params
    const post = await getPostById(postId)
    if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    if (post.influencerId !== authResult.userId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    return NextResponse.json({ post })
  } catch (error) {
    console.error('[ContentDetail GET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await getInfluencerUser()
    if (authResult instanceof NextResponse) return authResult

    const { postId } = await params
    const existing = await getPostById(postId)
    if (!existing) return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    if (existing.influencerId !== authResult.userId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    const body = await req.json().catch(() => null)
    if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

    // Handle status change separately
    if (body.status && body.status !== existing.status) {
      const publishedAt = body.status === 'published' ? new Date() : undefined
      const post = await updatePostStatus(postId, body.status, publishedAt)
      return NextResponse.json({ post })
    }

    const allowed = ['title', 'body', 'mediaType', 'mediaUrls', 'thumbnailUrl', 'platformsCrossPosted', 'productId', 'brandId', 'campaignId', 'tags', 'externalPostUrls']
    const updates: Record<string, any> = {}
    for (const key of allowed) {
      if (body[key] !== undefined) updates[key] = body[key]
    }

    const post = await updatePost(postId, updates)
    return NextResponse.json({ post })
  } catch (error) {
    console.error('[ContentDetail PATCH]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await getInfluencerUser()
    if (authResult instanceof NextResponse) return authResult

    const { postId } = await params
    const existing = await getPostById(postId)
    if (!existing) return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    if (existing.influencerId !== authResult.userId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    await deletePost(postId)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[ContentDetail DELETE]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
