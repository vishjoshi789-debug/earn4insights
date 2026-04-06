/**
 * Influencer Social Stats API
 *
 * GET  /api/influencer/social-stats — Get own social stats
 * POST /api/influencer/social-stats — Add/update platform stats
 *
 * Access: authenticated influencers
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { updateSocialStats } from '@/server/influencerProfileService'
import { getStatsByInfluencer } from '@/db/repositories/influencerSocialStatsRepository'

async function getInfluencerUser(): Promise<{ userId: string } | NextResponse> {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return { userId: (session.user as any).id }
}

export async function GET() {
  try {
    const authResult = await getInfluencerUser()
    if (authResult instanceof NextResponse) return authResult

    const stats = await getStatsByInfluencer(authResult.userId)
    return NextResponse.json({ stats })
  } catch (error) {
    console.error('[SocialStats GET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await getInfluencerUser()
    if (authResult instanceof NextResponse) return authResult

    const body = await req.json().catch(() => null)
    if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

    const { platform, followerCount, engagementRate, avgViews, avgLikes, avgComments } = body

    if (!platform || !['instagram', 'youtube', 'twitter', 'linkedin'].includes(platform)) {
      return NextResponse.json({ error: 'Invalid platform' }, { status: 400 })
    }

    await updateSocialStats(authResult.userId, platform, {
      followerCount, engagementRate, avgViews, avgLikes, avgComments,
    })

    const stats = await getStatsByInfluencer(authResult.userId)
    return NextResponse.json({ stats })
  } catch (error) {
    console.error('[SocialStats POST]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
