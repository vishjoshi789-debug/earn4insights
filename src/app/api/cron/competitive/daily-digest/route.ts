import 'server-only'
import { NextResponse } from 'next/server'
import { db } from '@/db'
import { competitorProfiles } from '@/db/schema'
import { and, eq } from 'drizzle-orm'
import { processDailyDigest } from '@/server/competitiveIntelligenceService'
import { logger } from '@/lib/logger'

/**
 * Cron: Daily competitive digest orchestrator.
 *
 * For each brand with active confirmed competitors:
 *   1. Score every category (fresh snapshot)
 *   2. Generate AI insights (capped at 3/brand/day, idempotent 24 h)
 *   3. Build a daily digest report if digestFrequency === 'daily'
 *
 * Trigger: Vercel Cron — daily (vercel.json).
 * Manual trigger: GET /api/cron/competitive/daily-digest
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startedAt = Date.now()
  try {
    const brandRows = await db
      .selectDistinct({ brandId: competitorProfiles.brandId })
      .from(competitorProfiles)
      .where(
        and(
          eq(competitorProfiles.isActive, true),
          eq(competitorProfiles.isConfirmed, true)
        )
      )

    let processed = 0
    let insightsGenerated = 0
    let digestsBuilt = 0
    const errors: Array<{ brandId: string; error: string }> = []

    for (const { brandId } of brandRows) {
      try {
        const result = await processDailyDigest(brandId)
        processed += 1
        insightsGenerated += result.insightsGenerated
        if (result.reportId) digestsBuilt += 1
      } catch (err) {
        errors.push({
          brandId,
          error: err instanceof Error ? err.message : 'unknown',
        })
      }
    }

    logger.cronResult('competitive/daily-digest', true, {
      brandsTotal: brandRows.length,
      processed,
      insightsGenerated,
      digestsBuilt,
      errorCount: errors.length,
      durationMs: Date.now() - startedAt,
    })

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      brandsTotal: brandRows.length,
      processed,
      insightsGenerated,
      digestsBuilt,
      errors,
    })
  } catch (error) {
    logger.cronResult('competitive/daily-digest', false, {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}
