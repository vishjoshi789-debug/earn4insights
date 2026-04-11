import { NextRequest, NextResponse } from 'next/server'
import { pgClient } from '@/db'

/**
 * Run migration 006: Content Approval System
 * POST /api/admin/run-migration-006
 * Header: x-api-key: <ADMIN_API_KEY>
 *
 * Adds content review columns to influencer_content_posts,
 * SLA settings to influencer_campaigns, and creates
 * content_review_reminders table.
 *
 * Prerequisites: migrations 001–005 must be applied first.
 * Idempotent: all statements use IF NOT EXISTS / ADD COLUMN IF NOT EXISTS.
 */
export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key')
  if (!process.env.ADMIN_API_KEY || apiKey !== process.env.ADMIN_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: { name: string; status: string }[] = []

  try {
    // ── 1. ALTER influencer_content_posts — review workflow columns ───
    const postColumns = [
      'review_submitted_at TIMESTAMP',
      'reviewed_at TIMESTAMP',
      'reviewed_by TEXT',
      'rejection_reason TEXT',
      'resubmission_count INTEGER DEFAULT 0',
      'previous_post_id UUID',
    ]
    for (const col of postColumns) {
      const colName = col.split(' ')[0]
      try {
        await pgClient.unsafe(`ALTER TABLE influencer_content_posts ADD COLUMN IF NOT EXISTS ${col}`)
      } catch (e: any) {
        if (e?.code === '42701') { /* column already exists */ } else throw e
      }
      results.push({ name: `influencer_content_posts.${colName}`, status: 'ok' })
    }

    // ── 2. ALTER influencer_campaigns — SLA settings ─────────────────
    try {
      await pgClient.unsafe(`ALTER TABLE influencer_campaigns ADD COLUMN IF NOT EXISTS review_sla_hours INTEGER`)
    } catch (e: any) {
      if (e?.code !== '42701') throw e
    }
    results.push({ name: 'influencer_campaigns.review_sla_hours', status: 'ok' })

    try {
      await pgClient.unsafe(`ALTER TABLE influencer_campaigns ADD COLUMN IF NOT EXISTS auto_approve_enabled BOOLEAN DEFAULT false`)
    } catch (e: any) {
      if (e?.code !== '42701') throw e
    }
    results.push({ name: 'influencer_campaigns.auto_approve_enabled', status: 'ok' })

    // ── 3. CREATE content_review_reminders ────────────────────────────
    await pgClient.unsafe(`
CREATE TABLE IF NOT EXISTS content_review_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL,
  campaign_id UUID NOT NULL,
  brand_id TEXT NOT NULL,
  reminder_type TEXT NOT NULL,
  scheduled_at TIMESTAMP NOT NULL,
  sent_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
)`)
    results.push({ name: 'content_review_reminders', status: 'ok' })

    await pgClient.unsafe(`
CREATE UNIQUE INDEX IF NOT EXISTS idx_review_reminders_post_type
  ON content_review_reminders (post_id, reminder_type)`)
    results.push({ name: 'idx_review_reminders_post_type', status: 'ok' })

    await pgClient.unsafe(`
CREATE INDEX IF NOT EXISTS idx_review_reminders_pending
  ON content_review_reminders (scheduled_at)
  WHERE sent_at IS NULL`)
    results.push({ name: 'idx_review_reminders_pending', status: 'ok' })

    return NextResponse.json({
      success: true,
      message: 'Migration 006 applied successfully',
      results,
    })
  } catch (error) {
    console.error('[Migration 006] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Migration 006 failed',
        detail: error instanceof Error ? error.message : 'Unknown error',
        results,
      },
      { status: 500 },
    )
  }
}
