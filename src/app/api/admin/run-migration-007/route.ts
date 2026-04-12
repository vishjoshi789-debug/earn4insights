import { NextRequest, NextResponse } from 'next/server'
import { pgClient } from '@/db'

/**
 * Run migration 007: Campaign Marketplace
 * POST /api/admin/run-migration-007
 * Header: x-api-key: <ADMIN_API_KEY>
 *
 * Adds marketplace columns to influencer_campaigns and creates
 * campaign_applications table with indexes.
 *
 * Prerequisites: migrations 001–006 must be applied first.
 * Idempotent: all statements use IF NOT EXISTS / ADD COLUMN IF NOT EXISTS.
 */
export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key')
  if (!process.env.ADMIN_API_KEY || apiKey !== process.env.ADMIN_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: { name: string; status: string }[] = []

  try {
    // ── 1. ALTER influencer_campaigns — marketplace columns ──────────
    const campaignColumns = [
      'is_public BOOLEAN NOT NULL DEFAULT false',
      'max_influencers INTEGER',
      'application_deadline DATE',
    ]
    for (const col of campaignColumns) {
      const colName = col.split(' ')[0]
      try {
        await pgClient.unsafe(`ALTER TABLE influencer_campaigns ADD COLUMN IF NOT EXISTS ${col}`)
      } catch (e: any) {
        if (e?.code === '42701') { /* column already exists */ } else throw e
      }
      results.push({ name: `influencer_campaigns.${colName}`, status: 'ok' })
    }

    // ── 2. CREATE campaign_applications ──────────────────────────────
    await pgClient.unsafe(`
CREATE TABLE IF NOT EXISTS campaign_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL,
  influencer_id TEXT NOT NULL,
  proposal_text TEXT NOT NULL,
  proposed_rate INTEGER NOT NULL,
  proposed_currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL DEFAULT 'pending',
  brand_response TEXT,
  applied_at TIMESTAMP NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMP
)`)
    results.push({ name: 'campaign_applications', status: 'ok' })

    // ── 3. Indexes ───────────────────────────────────────────────────
    await pgClient.unsafe(`
CREATE UNIQUE INDEX IF NOT EXISTS idx_campaign_applications_unique
  ON campaign_applications (campaign_id, influencer_id)`)
    results.push({ name: 'idx_campaign_applications_unique', status: 'ok' })

    await pgClient.unsafe(`
CREATE INDEX IF NOT EXISTS idx_campaign_applications_campaign_status
  ON campaign_applications (campaign_id, status)`)
    results.push({ name: 'idx_campaign_applications_campaign_status', status: 'ok' })

    await pgClient.unsafe(`
CREATE INDEX IF NOT EXISTS idx_campaign_applications_influencer_status
  ON campaign_applications (influencer_id, status)`)
    results.push({ name: 'idx_campaign_applications_influencer_status', status: 'ok' })

    await pgClient.unsafe(`
CREATE INDEX IF NOT EXISTS idx_campaign_applications_applied_at
  ON campaign_applications (applied_at DESC)`)
    results.push({ name: 'idx_campaign_applications_applied_at', status: 'ok' })

    // ── 4. Index on is_public for marketplace queries ────────────────
    await pgClient.unsafe(`
CREATE INDEX IF NOT EXISTS idx_campaigns_public_marketplace
  ON influencer_campaigns (is_public, status)
  WHERE is_public = true`)
    results.push({ name: 'idx_campaigns_public_marketplace', status: 'ok' })

    return NextResponse.json({
      success: true,
      message: 'Migration 007 applied successfully',
      results,
    })
  } catch (error) {
    console.error('[Migration 007] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Migration 007 failed',
        detail: error instanceof Error ? error.message : 'Unknown error',
        results,
      },
      { status: 500 },
    )
  }
}
