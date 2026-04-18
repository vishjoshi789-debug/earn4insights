/**
 * GET /api/deals/feed
 *
 * Personalized deal feed: featured, trending, expiring, newest, most saved, for-you.
 * Optional auth — logged-in users get category-matched "for you" section.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { getDealFeed } from '@/server/dealsService'
import { db } from '@/db'
import { userProfiles } from '@/db/schema'
import { eq } from 'drizzle-orm'

export async function GET(req: NextRequest) {
  try {
    let userInterests: string[] | undefined

    const session = await auth()
    if (session?.user?.email) {
      const userId = (session.user as any).id
      const [profile] = await db
        .select({ interests: userProfiles.interests })
        .from(userProfiles)
        .where(eq(userProfiles.id, userId))
        .limit(1)

      if (profile?.interests) {
        const parsed = typeof profile.interests === 'string'
          ? JSON.parse(profile.interests)
          : profile.interests
        userInterests = parsed?.productCategories ?? []
      }
    }

    const feed = await getDealFeed(userInterests)
    return NextResponse.json(feed)
  } catch (error) {
    console.error('[DealsFeed GET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
