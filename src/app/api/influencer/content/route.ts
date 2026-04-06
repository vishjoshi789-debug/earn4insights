/**
 * Influencer Content Posts API
 *
 * GET  /api/influencer/content — List own content posts
 * POST /api/influencer/content — Create a new content post
 *
 * Access: authenticated influencers
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import {
  createPost,
  getPostsByInfluencer,
} from '@/db/repositories/influencerContentPostRepository'

async function getInfluencerUser(): Promise<{ userId: string } | NextResponse> {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return { userId: (session.user as any).id }
}

export async function GET(req: NextRequest) {
  try {
    const authResult = await getInfluencerUser()
    if (authResult instanceof NextResponse) return authResult

    const params = req.nextUrl.searchParams
    const status = params.get('status') ?? undefined
    const campaignId = params.get('campaignId') ?? undefined
    const limit = Math.min(parseInt(params.get('limit') ?? '20'), 50)
    const offset = parseInt(params.get('offset') ?? '0')

    const posts = await getPostsByInfluencer(authResult.userId, { status, campaignId, limit, offset })
    return NextResponse.json({ posts, total: posts.length })
  } catch (error) {
    console.error('[Content GET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await getInfluencerUser()
    if (authResult instanceof NextResponse) return authResult

    const body = await req.json().catch(() => null)
    if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

    const { title, body: postBody, mediaType, mediaUrls, thumbnailUrl, platformsCrossPosted, productId, brandId, campaignId, tags } = body

    if (!title || typeof title !== 'string') {
      return NextResponse.json({ error: 'title is required' }, { status: 400 })
    }

    const post = await createPost({
      influencerId: authResult.userId,
      title,
      body: postBody ?? null,
      mediaType: mediaType ?? 'image',
      mediaUrls: mediaUrls ?? [],
      thumbnailUrl: thumbnailUrl ?? null,
      platformsCrossPosted: platformsCrossPosted ?? [],
      productId: productId ?? null,
      brandId: brandId ?? null,
      campaignId: campaignId ?? null,
      tags: tags ?? [],
      status: 'draft',
    })

    return NextResponse.json({ post }, { status: 201 })
  } catch (error) {
    console.error('[Content POST]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
