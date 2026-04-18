/**
 * GET /api/brand/community-deals
 *
 * List community posts mentioning this brand. Brand role only.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { getBrandCommunityPosts } from '@/server/communityService'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const role = (session.user as any).role
    if (role !== 'brand') {
      return NextResponse.json({ error: 'Brand access only' }, { status: 403 })
    }
    const userId = (session.user as any).id

    const p = req.nextUrl.searchParams
    const result = await getBrandCommunityPosts(
      userId,
      p.get('cursor') ?? undefined,
      Math.min(parseInt(p.get('limit') ?? '20'), 50)
    )
    return NextResponse.json(result)
  } catch (error) {
    console.error('[BrandCommunityDeals GET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
