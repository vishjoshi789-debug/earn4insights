/**
 * GET  /api/community-deals/posts — Community feed (approved posts, search, filter, sort)
 * POST /api/community-deals/posts — Create a new community deal post
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { getCommunityFeed, createCommunityPost } from '@/server/communityService'

export async function GET(req: NextRequest) {
  try {
    const p = req.nextUrl.searchParams
    const result = await getCommunityFeed({
      q: p.get('q') ?? undefined,
      category: p.get('category') ?? undefined,
      postType: p.get('postType') ?? undefined,
      sort: (p.get('sort') as any) ?? 'newest',
      cursor: p.get('cursor') ?? undefined,
      limit: Math.min(parseInt(p.get('limit') ?? '20'), 50),
    })
    return NextResponse.json(result)
  } catch (error) {
    console.error('[CommunityPosts GET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = (session.user as any).id
    const role = (session.user as any).role ?? 'consumer'

    const body = await req.json().catch(() => null)
    if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

    const { title, body: postBody, postType, imageUrls, productId, brandId, dealId, externalUrl, promoCode, discountDetails, category, tags } = body

    if (!title || typeof title !== 'string') {
      return NextResponse.json({ error: 'title is required' }, { status: 400 })
    }
    if (!postBody || typeof postBody !== 'string') {
      return NextResponse.json({ error: 'body is required' }, { status: 400 })
    }

    const post = await createCommunityPost(userId, role, {
      title,
      body: postBody,
      postType: postType ?? 'deal',
      imageUrls: imageUrls ?? [],
      productId: productId ?? null,
      brandId: brandId ?? null,
      dealId: dealId ?? null,
      externalUrl: externalUrl ?? null,
      promoCode: promoCode ?? null,
      discountDetails: discountDetails ?? null,
      category: category ?? null,
      tags: tags ?? [],
    })

    return NextResponse.json({ post }, { status: 201 })
  } catch (error: any) {
    if (error.message?.includes('promo code')) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    console.error('[CommunityPosts POST]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
