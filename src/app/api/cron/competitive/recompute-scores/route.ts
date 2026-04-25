import 'server-only'
import { NextResponse } from 'next/server'
import { db } from '@/db'
import { competitorProfiles } from '@/db/schema'
import { and, eq } from 'drizzle-orm'
import { scoreBrandForAllCategories } from '@/server/competitiveScoringService'
import { logger } from '@/lib/logger'

/**
 * Cron: Recompute competitive scores for every brand with active competitors.
 *
 * Trigger: Vercel Cron — daily (vercel.json). Frequent recompute (every 15 min)
 * is wired via cron-job.org per approved plan (Q1).
 * Manual trigger: GET /api/cron/competitive/recompute-scores
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

    let scoredBrands = 0
    let scoredCategories = 0
    const errors: Array<{ brandId: string; error: string }> = []

    for (const { brandId } of brandRows) {
      try {
        const results = await scoreBrandForAllCategories(brandId)
        scoredBrands += 1
        scoredCategories += results.length
      } catch (err) {
        errors.push({
          brandId,
          error: err instanceof Error ? err.message : 'unknown',
        })
      }
    }

    logger.cronResult('competitive/recompute-scores', true, {
      brandsTotal: brandRows.length,
      scoredBrands,
      scoredCategories,
      errorCount: errors.length,
      durationMs: Date.now() - startedAt,
    })

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      brandsTotal: brandRows.length,
      scoredBrands,
      scoredCategories,
      errors,
    })
  } catch (error) {
    logger.cronResult('competitive/recompute-scores', false, {
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
