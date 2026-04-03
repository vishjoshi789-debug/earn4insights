/**
 * Cron: Recompute ICP Match Scores
 * GET /api/cron/recompute-icp-scores
 *
 * Runs daily at 03:00 UTC (see vercel.json), after update-consumer-signals (02:30).
 * Re-scores all stale icp_match_scores rows and fires 'icp_match' brand alerts
 * for consumers that newly cross an ICP's match threshold.
 *
 * Auth: Bearer CRON_SECRET header (Vercel Cron injects this automatically).
 */

import { NextRequest, NextResponse } from 'next/server'
import { runRecomputeIcpScores } from '@/server/recomputeIcpScores'

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await runRecomputeIcpScores()

    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (error) {
    console.error('[Cron recompute-icp-scores] Fatal error:', error)
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
