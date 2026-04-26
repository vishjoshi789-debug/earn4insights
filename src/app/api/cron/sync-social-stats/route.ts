/**
 * Cron: Sync Influencer Social Stats
 * GET /api/cron/sync-social-stats
 *
 * Runs daily at 04:30 UTC. For each active influencer with a youtube_handle,
 * calls YouTube Data API v3 to verify subscriber/view/video counts and upserts
 * api_verified stats. Falls back to keeping self_declared rows on API errors.
 *
 * Auth: Bearer CRON_SECRET header (Vercel Cron injects automatically).
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { influencerProfiles } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { getStatsByInfluencer, getStatsByPlatform, upsertStats } from '@/db/repositories/influencerSocialStatsRepository'

type YouTubeChannelStats = {
  subscriberCount: number
  viewCount: number
  videoCount: number
}

type YouTubeFetchResult =
  | { ok: true; stats: YouTubeChannelStats }
  | { ok: false; reason: 'not_found' | 'quota_exceeded' | 'api_error'; message: string }

async function fetchYouTubeChannelStats(handle: string, apiKey: string): Promise<YouTubeFetchResult> {
  // Strip leading @ — forHandle accepts handles with or without it but be consistent
  const cleanHandle = handle.startsWith('@') ? handle.slice(1) : handle

  const url = `https://www.googleapis.com/youtube/v3/channels?part=statistics&forHandle=${encodeURIComponent(cleanHandle)}&key=${encodeURIComponent(apiKey)}`

  let res: Response
  try {
    res = await fetch(url, { next: { revalidate: 0 } })
  } catch (err) {
    return { ok: false, reason: 'api_error', message: String(err) }
  }

  if (res.status === 403) {
    let body: any = {}
    try { body = await res.json() } catch {}
    const reason = body?.error?.errors?.[0]?.reason ?? ''
    if (reason === 'quotaExceeded' || reason === 'dailyLimitExceeded') {
      return { ok: false, reason: 'quota_exceeded', message: `YouTube quota exceeded (${reason})` }
    }
    return { ok: false, reason: 'api_error', message: `YouTube API 403: ${reason}` }
  }

  if (res.status === 429) {
    return { ok: false, reason: 'quota_exceeded', message: 'YouTube API rate limited (429)' }
  }

  if (!res.ok) {
    return { ok: false, reason: 'api_error', message: `YouTube API ${res.status}` }
  }

  let data: any
  try { data = await res.json() } catch {
    return { ok: false, reason: 'api_error', message: 'Invalid JSON from YouTube API' }
  }

  const item = data?.items?.[0]
  if (!item) {
    return { ok: false, reason: 'not_found', message: `Channel not found for handle: ${cleanHandle}` }
  }

  const s = item.statistics ?? {}
  return {
    ok: true,
    stats: {
      subscriberCount: parseInt(s.subscriberCount ?? '0', 10),
      viewCount: parseInt(s.viewCount ?? '0', 10),
      videoCount: parseInt(s.videoCount ?? '0', 10),
    },
  }
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const apiKey = process.env.YOUTUBE_API_KEY
    const youtubeEnabled = !!apiKey

    // Fetch all active influencer profiles
    const activeProfiles = await db
      .select({
        id: influencerProfiles.id,
        userId: influencerProfiles.userId,
        youtubeHandle: influencerProfiles.youtubeHandle,
      })
      .from(influencerProfiles)
      .where(eq(influencerProfiles.isActive, true))

    let totalStats = 0
    let verified = 0
    let selfDeclared = 0
    let apiVerified = 0
    let skipped = 0
    let failed = 0
    const errors: { userId: string; platform: string; error: string }[] = []
    let quotaExhausted = false

    for (const profile of activeProfiles) {
      try {
        const stats = await getStatsByInfluencer(profile.userId)
        totalStats += stats.length

        // ── YouTube API verification ──────────────────────────────────────
        if (youtubeEnabled && profile.youtubeHandle && !quotaExhausted) {
          const result = await fetchYouTubeChannelStats(profile.youtubeHandle, apiKey)

          if (result.ok) {
            const { subscriberCount, viewCount, videoCount } = result.stats
            const now = new Date()

            // Preserve existing engagement/like/comment fields — YouTube channel
            // stats don't expose per-video engagement; keep self-declared values
            const existing = await getStatsByPlatform(profile.userId, 'youtube')

            await upsertStats({
              influencerId: profile.userId,
              platform: 'youtube',
              followerCount: subscriberCount,
              avgViews: Math.round(viewCount / Math.max(videoCount, 1)),
              engagementRate: existing?.engagementRate ?? null,
              avgLikes: existing?.avgLikes ?? null,
              avgComments: existing?.avgComments ?? null,
              verifiedAt: now,
              verificationMethod: 'api_verified',
              rawApiResponse: {
                subscriberCount,
                viewCount,
                videoCount,
                fetchedAt: now.toISOString(),
              },
            })

            apiVerified++
          } else if (result.reason === 'quota_exceeded') {
            console.warn(`[Cron sync-social-stats] ${result.message} — stopping YouTube verification`)
            quotaExhausted = true
            skipped++
          } else if (result.reason === 'not_found') {
            // Channel gone or handle wrong — keep existing self_declared row as-is
            console.warn(`[Cron sync-social-stats] ${result.message}`)
            skipped++
          } else {
            console.error(`[Cron sync-social-stats] YouTube API error for ${profile.userId}: ${result.message}`)
            failed++
            errors.push({ userId: profile.userId, platform: 'youtube', error: result.message })
          }
        }

        // Tally verification status across all platforms for this profile
        for (const stat of stats) {
          if (stat.platform === 'youtube' && youtubeEnabled && profile.youtubeHandle) continue
          if (stat.verificationMethod === 'api_verified') verified++
          else selfDeclared++
        }

      } catch (e: any) {
        errors.push({ userId: profile.userId, platform: 'all', error: e?.message ?? String(e) })
      }
    }

    return NextResponse.json({
      success: true,
      profiles: activeProfiles.length,
      totalStats,
      totalProcessed: activeProfiles.length,
      verified: verified + apiVerified,
      apiVerified,
      selfDeclared,
      skipped,
      failed,
      errors: errors.length > 0 ? errors : undefined,
      youtubeEnabled,
      ...(quotaExhausted && { quotaExhausted: true }),
      note: !youtubeEnabled
        ? 'YOUTUBE_API_KEY not set — all stats remain self-declared'
        : quotaExhausted
        ? 'YouTube quota exhausted mid-run — remaining profiles skipped'
        : apiVerified > 0
        ? `${apiVerified} YouTube channel(s) verified via API`
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
