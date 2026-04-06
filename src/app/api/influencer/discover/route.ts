/**
 * Influencer Discovery API
 *
 * GET /api/influencer/discover — Browse/search influencer profiles
 * Query: ?niche=beauty&location=Mumbai&verified=true&limit=20&offset=0
 *
 * Access: any authenticated user
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { discoverInfluencers } from '@/server/influencerProfileService'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const params = req.nextUrl.searchParams
    const niche = params.get('niche') ?? undefined
    const location = params.get('location') ?? undefined
    const verified = params.get('verified') === 'true' ? true : undefined
    const limit = Math.min(parseInt(params.get('limit') ?? '20'), 50)
    const offset = parseInt(params.get('offset') ?? '0')

    const influencers = await discoverInfluencers({ niche, location, verified, limit, offset })

    return NextResponse.json({ influencers, total: influencers.length })
  } catch (error) {
    console.error('[InfluencerDiscover GET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
