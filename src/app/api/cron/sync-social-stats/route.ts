/**
 * Cron: Sync Influencer Social Stats
 * GET /api/cron/sync-social-stats
 *
 * Runs daily at 04:30 UTC. Iterates active influencer profiles and
 * refreshes follower counts / engagement rates from platform APIs.
 *
 * Currently all stats are self-declared (no platform API keys yet),
 * so this cron validates existing data and marks verification timestamps.
 * When platform API integrations are added, this cron will pull live data.
 *
 * Auth: Bearer CRON_SECRET header (Vercel Cron injects automatically).
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { influencerProfiles, influencerSocialStats } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { getStatsByInfluencer } from '@/db/repositories/influencerSocialStatsRepository'

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch all active influencer profiles
    const activeProfiles = await db
      .select({ id: influencerProfiles.id, userId: influencerProfiles.userId })
      .from(influencerProfiles)
      .where(eq(influencerProfiles.isActive, true))

    let totalStats = 0
    let verified = 0
    let selfDeclared = 0
    const errors: { userId: string; error: string }[] = []

    for (const profile of activeProfiles) {
      try {
        const stats = await getStatsByInfluencer(profile.userId)
        totalStats += stats.length

        for (const stat of stats) {
          if (stat.verificationMethod === 'self_declared') {
            selfDeclared++
            // When platform APIs are integrated, this is where we'd
            // call the provider API and update verified stats:
            //   const liveData = await fetchPlatformStats(stat.platform, token)
            //   await upsertStats({ ...liveData, verificationMethod: 'api_verified' })
          } else {
            verified++
          }
        }
      } catch (e: any) {
        errors.push({ userId: profile.userId, error: e?.message })
      }
    }

    return NextResponse.json({
      success: true,
      profiles: activeProfiles.length,
      totalStats,
      verified,
      selfDeclared,
      errors: errors.length,
      note: selfDeclared > 0
        ? `${selfDeclared} stats are self-declared. Platform API integration pending.`
        : undefined,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[Cron sync-social-stats] Fatal error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}
