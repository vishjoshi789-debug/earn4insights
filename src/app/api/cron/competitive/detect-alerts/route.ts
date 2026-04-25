import 'server-only'
import { NextResponse } from 'next/server'
import { db } from '@/db'
import { products, competitorProfiles } from '@/db/schema'
import { and, eq } from 'drizzle-orm'
import {
  getCompetitorProfiles,
  getCompetitorProducts,
} from '@/db/repositories/competitiveIntelligenceRepository'
import {
  detectSentimentShift,
  detectConsumerSwitching,
  detectMarketShareChange,
} from '@/server/competitiveAlertService'
import { logger } from '@/lib/logger'

/**
 * Cron: Sweep all tracked competitors and run the three periodic alert
 * detectors that don't require an external trigger:
 *   - sentiment spike/drop (per brand × category)
 *   - consumer switching (per brand × competitor, 90-day window)
 *   - market-share change (per brand × category)
 *
 * Event-triggered detectors (`new_product`, `new_deal`, `price_change`,
 * `influencer_campaign`, `new_community_post`) are fired inline by the
 * relevant API routes, not here.
 *
 * Trigger: Vercel Cron — daily (vercel.json). Frequent runs (every 30 min)
 * are wired via cron-job.org per approved plan (Q1).
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
    let sentimentAlerts = 0
    let switchingAlerts = 0
    let marketShareAlerts = 0
    const errors: Array<{ brandId: string; stage: string; error: string }> = []

    for (const { brandId } of brandRows) {
      try {
        const brandProductRows = await db
          .select({ id: products.id })
          .from(products)
          .where(eq(products.ownerId, brandId))
        const brandProductIds = brandProductRows.map((r) => r.id)

        const profiles = await getCompetitorProfiles(brandId, {
          activeOnly: true,
          confirmedOnly: true,
        })
        const categories = Array.from(new Set(profiles.map((p) => p.category))).filter(Boolean)

        // ── 1. Sentiment shift per category
        for (const category of categories) {
          try {
            const res = await detectSentimentShift({ brandId, brandProductIds, category })
            if (res) sentimentAlerts += 1
          } catch (err) {
            errors.push({
              brandId,
              stage: `sentiment:${category}`,
              error: err instanceof Error ? err.message : 'unknown',
            })
          }
        }

        // ── 2. Consumer switching per (brand × competitor)
        for (const profile of profiles) {
          try {
            const compProducts = await getCompetitorProducts(profile.id, { activeOnly: true })
            const competitorProductIds = compProducts
              .map((cp) => cp.productId)
              .filter((id): id is string => typeof id === 'string')
            if (competitorProductIds.length === 0) continue
            const fired = await detectConsumerSwitching({
              brandId,
              brandProductIds,
              competitorProfileId: profile.id,
              competitorName: profile.competitorName,
              competitorProductIds,
            })
            if (Array.isArray(fired)) switchingAlerts += fired.filter(Boolean).length
          } catch (err) {
            errors.push({
              brandId,
              stage: `switching:${profile.id}`,
              error: err instanceof Error ? err.message : 'unknown',
            })
          }
        }

        // ── 3. Market-share change per category
        for (const category of categories) {
          try {
            const profilesInCat = profiles.filter((p) => p.category === category)
            const categoryProductIds: string[] = [...brandProductIds]
            for (const p of profilesInCat) {
              const compProducts = await getCompetitorProducts(p.id, { activeOnly: true })
              for (const cp of compProducts) {
                if (cp.productId) categoryProductIds.push(cp.productId)
              }
            }
            if (categoryProductIds.length === 0) continue
            const res = await detectMarketShareChange({
              brandId,
              brandProductIds,
              categoryProductIds,
              category,
            })
            if (res) marketShareAlerts += 1
          } catch (err) {
            errors.push({
              brandId,
              stage: `market_share:${category}`,
              error: err instanceof Error ? err.message : 'unknown',
            })
          }
        }

        brandsProcessed += 1
      } catch (err) {
        errors.push({
          brandId,
          stage: 'brand',
          error: err instanceof Error ? err.message : 'unknown',
        })
      }
    }

    logger.cronResult('competitive/detect-alerts', true, {
      brandsTotal: brandRows.length,
      brandsProcessed,
      sentimentAlerts,
      switchingAlerts,
      marketShareAlerts,
      errorCount: errors.length,
      durationMs: Date.now() - startedAt,
    })

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      brandsTotal: brandRows.length,
      brandsProcessed,
      sentimentAlerts,
      switchingAlerts,
      marketShareAlerts,
      errors,
    })
  } catch (error) {
    logger.cronResult('competitive/detect-alerts', false, {
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
