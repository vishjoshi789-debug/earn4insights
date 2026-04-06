/**
 * Influencer Profile API
 *
 * GET  /api/influencer/profile — Get own influencer profile
 * POST /api/influencer/profile — Register as influencer / create profile
 * PATCH /api/influencer/profile — Update profile
 *
 * Access: authenticated consumers
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import {
  registerAsInfluencer,
  getInfluencerPublicProfile,
  updateInfluencerProfile,
} from '@/server/influencerProfileService'
import { getProfileByUserId } from '@/db/repositories/influencerProfileRepository'
import { getStatsByInfluencer } from '@/db/repositories/influencerSocialStatsRepository'

async function getAuthUser(): Promise<{ userId: string; role: string } | NextResponse> {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return {
    userId: (session.user as any).id,
    role: (session.user as any).role,
  }
}

export async function GET() {
  try {
    const authResult = await getAuthUser()
    if (authResult instanceof NextResponse) return authResult
    const { userId } = authResult

    const profile = await getProfileByUserId(userId)
    if (!profile) {
      return NextResponse.json({ profile: null, registered: false })
    }

    const socialStats = await getStatsByInfluencer(userId)
    return NextResponse.json({ profile, socialStats, registered: true })
  } catch (error) {
    console.error('[InfluencerProfile GET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await getAuthUser()
    if (authResult instanceof NextResponse) return authResult
    const { userId } = authResult

    const body = await req.json().catch(() => null)
    if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

    const { displayName, bio, niche, location, instagramHandle, youtubeHandle, twitterHandle, linkedinHandle, baseRate, currency } = body

    if (!displayName || typeof displayName !== 'string') {
      return NextResponse.json({ error: 'displayName is required' }, { status: 400 })
    }
    if (!niche || !Array.isArray(niche) || niche.length === 0) {
      return NextResponse.json({ error: 'niche must be a non-empty array' }, { status: 400 })
    }

    const profile = await registerAsInfluencer(userId, {
      displayName, bio, niche, location,
      instagramHandle, youtubeHandle, twitterHandle, linkedinHandle,
      baseRate, currency,
    })

    return NextResponse.json({ profile }, { status: 201 })
  } catch (error: any) {
    if (error.message?.includes('already registered')) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    console.error('[InfluencerProfile POST]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const authResult = await getAuthUser()
    if (authResult instanceof NextResponse) return authResult
    const { userId } = authResult

    const body = await req.json().catch(() => null)
    if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

    const allowed = ['displayName', 'bio', 'niche', 'location', 'instagramHandle', 'youtubeHandle', 'twitterHandle', 'linkedinHandle', 'baseRate', 'currency', 'portfolioUrls']
    const updates: Record<string, any> = {}
    for (const key of allowed) {
      if (body[key] !== undefined) updates[key] = body[key]
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const profile = await updateInfluencerProfile(userId, updates)
    return NextResponse.json({ profile })
  } catch (error: any) {
    if (error.message?.includes('not found')) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }
    console.error('[InfluencerProfile PATCH]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
