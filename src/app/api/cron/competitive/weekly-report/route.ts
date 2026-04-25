import 'server-only'
import { NextResponse } from 'next/server'
import { db } from '@/db'
import { competitorProfiles } from '@/db/schema'
import { and, eq } from 'drizzle-orm'
import {
  getCompetitorProfiles,
  getDigestPreferences,
} from '@/db/repositories/competitiveIntelligenceRepository'
import { generateWeeklyReport } from '@/server/competitiveIntelligenceService'
import { logger } from '@/lib/logger'

/**
 * Cron: Weekly competitive summary report — one per (brand × category).
 *
 * Runs the full weekly AI flow (gpt-4o) for each opted-in brand that has
 * active confirmed competitors. Email sending is handled by a separate
 * mailer cron (Phase 8); this cron only creates the report rows and leaves
 * `emailSent = false`.
 *
 * Respects `competitor_digest_preferences.digestFrequency`:
 *   - 'weekly' → runs for every tracked category
 *   - 'none'  → skipped
 *   - 'daily' / 'monthly' → skipped here (they have their own cadence)
 *
 * Trigger: Vercel Cron — weekly (vercel.json, Mondays at 6 AM UTC).
 * Manual trigger: GET /api/cron/competitive/weekly-report
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

    let brandsProcessed = 0
    let reportsCreated = 0
    const skipped: Array<{ brandId: string; reason: string }> = []
    const errors: Array<{ brandId: string; category: string; error: string }> = []

    for (const { brandId } of brandRows) {
      try {
        const prefs = await getDigestPreferences(brandId)
        // Default frequency is 'weekly' when no prefs row exists.
        const freq = prefs?.digestFrequency ?? 'weekly'
        if (freq !== 'weekly') {
          skipped.push({ brandId, reason: `frequency:${freq}` })
          continue
        }

        const profiles = await getCompetitorProfiles(brandId, {
          activeOnly: true,
          confirmedOnly: true,
        })
        const categories = Array.from(new Set(profiles.map((p) => p.category))).filter(Boolean)
        if (categories.length === 0) {
          skipped.push({ brandId, reason: 'no_categories' })
          continue
        }
        // Honour per-category opt-in when the prefs row lists categories.
        const allowedCategories = prefs?.categories && prefs.categories.length > 0
          ? categories.filter((c) => prefs.categories!.includes(c))
          : categories
        if (allowedCategories.length === 0) {
          skipped.push({ brandId, reason: 'no_allowed_categories' })
          continue
        }

        for (const category of allowedCategories) {
          try {
            const { reportId } = await generateWeeklyReport(brandId, category)
            if (reportId) reportsCreated += 1
          } catch (err) {
            errors.push({
              brandId,
              category,
              error: err instanceof Error ? err.message : 'unknown',
            })
          }
        }
        brandsProcessed += 1
      } catch (err) {
        errors.push({
          brandId,
          category: '*',
          error: err instanceof Error ? err.message : 'unknown',
        })
      }
    }

    logger.cronResult('competitive/weekly-report', true, {
      brandsTotal: brandRows.length,
      brandsProcessed,
      reportsCreated,
      skippedCount: skipped.length,
      errorCount: errors.length,
      durationMs: Date.now() - startedAt,
    })

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      brandsTotal: brandRows.length,
      brandsProcessed,
      reportsCreated,
      skipped,
      errors,
    })
  } catch (error) {
    logger.cronResult('competitive/weekly-report', false, {
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
