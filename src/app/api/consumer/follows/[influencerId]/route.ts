/**
 * Consumer Follow/Unfollow API
 *
 * POST   /api/consumer/follows/[influencerId] — Follow influencer
 * DELETE /api/consumer/follows/[influencerId] — Unfollow influencer
 * GET    /api/consumer/follows/[influencerId] — Check follow status
 *
 * Access: authenticated consumers
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import {
  follow,
  unfollow,
  isFollowing,
  getFollowerCount,
} from '@/db/repositories/influencerFollowRepository'

type RouteParams = { params: Promise<{ influencerId: string }> }

async function getConsumerUser(): Promise<{ userId: string } | NextResponse> {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return { userId: (session.user as any).id }
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await getConsumerUser()
    if (authResult instanceof NextResponse) return authResult

    const { influencerId } = await params
    const following = await isFollowing(authResult.userId, influencerId)
    const followerCount = await getFollowerCount(influencerId)

    return NextResponse.json({ following, followerCount })
  } catch (error) {
    console.error('[Follow GET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await getConsumerUser()
    if (authResult instanceof NextResponse) return authResult

    const { influencerId } = await params
    if (authResult.userId === influencerId) {
      return NextResponse.json({ error: 'Cannot follow yourself' }, { status: 400 })
    }

    await follow(authResult.userId, influencerId)
    return NextResponse.json({ success: true, following: true })
  } catch (error) {
    console.error('[Follow POST]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await getConsumerUser()
    if (authResult instanceof NextResponse) return authResult

    const { influencerId } = await params
    await unfollow(authResult.userId, influencerId)
    return NextResponse.json({ success: true, following: false })
  } catch (error) {
    console.error('[Follow DELETE]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
