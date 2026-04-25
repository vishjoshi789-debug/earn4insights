import 'server-only'
import { NextResponse } from 'next/server'
import { db } from '@/db'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'
import {
  getUnsentReports,
  getDigestPreferences,
  markReportEmailed,
} from '@/db/repositories/competitiveIntelligenceRepository'
import { sendCompetitiveReportEmail } from '@/server/competitiveEmailService'
import { logger } from '@/lib/logger'

/**
 * Cron: Drain pending competitive reports to email.
 *
 * Picks the oldest 100 reports with `emailSent = false`, looks up the
 * brand's email + digest preferences, sends via Resend, and only flips
 * `emailSent = true` on a successful send. Failed sends stay in the queue
 * for the next run.
 *
 * Preferences honoured:
 *   - emailEnabled = false → marked emailed (skipped) so queue drains
 *   - digestFrequency = 'none' → marked emailed (skipped)
 *
 * Trigger: Vercel Cron — daily (vercel.json), after digest/report crons.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startedAt = Date.now()
  try {
    const pending = await getUnsentReports(100)

    // Cache (brandId → { email, name, prefs }) to avoid repeat lookups
    const brandCache = new Map<
      string,
      { email: string | null; name: string; emailEnabled: boolean; frequency: string }
    >()
    async function getBrand(brandId: string) {
      const cached = brandCache.get(brandId)
      if (cached) return cached
      const [u] = await db
        .select({ email: users.email, name: users.name })
        .from(users)
        .where(eq(users.id, brandId))
        .limit(1)
      const prefs = await getDigestPreferences(brandId)
      const entry = {
        email: u?.email ?? null,
        name: u?.name ?? 'Brand',
        emailEnabled: prefs?.emailEnabled ?? true,
        frequency: prefs?.digestFrequency ?? 'weekly',
      }
      brandCache.set(brandId, entry)
      return entry
    }

    let sent = 0
    let skipped = 0
    const errors: Array<{ reportId: string; error: string }> = []

    for (const report of pending) {
      try {
        const brand = await getBrand(report.brandId)
        if (!brand.email || !brand.emailEnabled || brand.frequency === 'none') {
          // Mark as emailed so we don't keep retrying for disabled brands.
          await markReportEmailed(report.id)
          skipped += 1
          continue
        }
        const result = await sendCompetitiveReportEmail({
          report: {
            id: report.id,
            brandId: report.brandId,
            reportType: report.reportType,
            title: report.title,
            content: report.content,
            category: report.category,
            periodStart: report.periodStart,
            periodEnd: report.periodEnd,
          },
          recipientEmail: brand.email,
          brandName: brand.name,
        })
        if (result.success) {
          await markReportEmailed(report.id)
          sent += 1
        } else {
          errors.push({ reportId: report.id, error: result.error ?? 'unknown' })
        }
      } catch (err) {
        errors.push({
          reportId: report.id,
          error: err instanceof Error ? err.message : 'unknown',
        })
      }
    }

    logger.cronResult('competitive/send-reports', true, {
      pending: pending.length,
      sent,
      skipped,
      errorCount: errors.length,
      durationMs: Date.now() - startedAt,
    })

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      pending: pending.length,
      sent,
      skipped,
      errors,
    })
  } catch (error) {
    logger.cronResult('competitive/send-reports', false, {
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
