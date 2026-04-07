/**
 * Cron: Aggregate Campaign Performance Metrics
 * GET /api/cron/update-campaign-performance
 *
 * Runs daily at 03:30 UTC. Iterates active campaigns and computes
 * aggregate performance summaries (total views, engagement, reach).
 *
 * Auth: Bearer CRON_SECRET header (Vercel Cron injects automatically).
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { influencerCampaigns } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { getCampaignAnalytics } from '@/server/campaignPerformanceService'

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch all active campaigns
    const activeCampaigns = await db
      .select({ id: influencerCampaigns.id })
      .from(influencerCampaigns)
      .where(eq(influencerCampaigns.status, 'active'))

    const results: { campaignId: string; status: 'ok' | 'error'; detail?: string }[] = []

    for (const campaign of activeCampaigns) {
      try {
        await getCampaignAnalytics(campaign.id)
        results.push({ campaignId: campaign.id, status: 'ok' })
      } catch (e: any) {
        results.push({ campaignId: campaign.id, status: 'error', detail: e?.message })
      }
    }

    return NextResponse.json({
      success: true,
      processed: activeCampaigns.length,
      ok: results.filter(r => r.status === 'ok').length,
      errors: results.filter(r => r.status === 'error').length,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[Cron update-campaign-performance] Fatal error:', error)
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
