import { NextRequest, NextResponse } from 'next/server'
import { pgClient } from '@/db'

/**
 * Run migration 024: Influencer onboarding wizard schema additions (Phase 3.5C)
 * POST /api/admin/run-migration-024
 * Header: x-api-key: <ADMIN_API_KEY>
 *
 * Adds 4 columns to influencer_profiles to support the 6-step
 * Influencer Onboarding Wizard:
 *
 *   - profile_image_url       TEXT
 *   - tiktok_handle           TEXT
 *   - content_types           TEXT[] NOT NULL DEFAULT '{}'
 *   - audience_demographics   JSONB  NOT NULL DEFAULT '{}'
 *
 * The audience_demographics shape (Zod-validated at write time, not
 * enforced by Postgres):
 *
 *   {
 *     ageBrackets:   { "18-24": number, "25-34": ..., "35-44": ..., ... },  // % split, soft sum<=100
 *     gender:        { male: number, female: number, other: number },        // % split, soft sum<=100
 *     topCountries:  string[]                                                // ISO-2 country codes, max 5
 *   }
 *
 * Idempotent: ADD COLUMN IF NOT EXISTS throughout. Safe to re-run.
 *
 * No backfill needed — all columns get sensible defaults. Existing
 * influencer_profiles rows (the 1 grandfathered legacy influencer)
 * will have empty content_types + empty audience_demographics until
 * they re-run the wizard. The 3.5C wizard hydrates from existing
 * data + lets the user click through to mark onboarding_completed=true
 * with their prior data preserved (Q7 humane-prefill path).
 */
export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key')
  if (!process.env.ADMIN_API_KEY || apiKey !== process.env.ADMIN_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: { name: string; status: string }[] = []

  try {
    await pgClient.unsafe(`
      ALTER TABLE influencer_profiles
        ADD COLUMN IF NOT EXISTS profile_image_url TEXT
    `)
    results.push({ name: 'influencer_profiles.profile_image_url', status: 'added' })

    await pgClient.unsafe(`
      ALTER TABLE influencer_profiles
        ADD COLUMN IF NOT EXISTS tiktok_handle TEXT
    `)
    results.push({ name: 'influencer_profiles.tiktok_handle', status: 'added' })

    await pgClient.unsafe(`
      ALTER TABLE influencer_profiles
        ADD COLUMN IF NOT EXISTS content_types TEXT[] NOT NULL DEFAULT '{}'
    `)
    results.push({ name: 'influencer_profiles.content_types', status: 'added' })

    await pgClient.unsafe(`
      ALTER TABLE influencer_profiles
        ADD COLUMN IF NOT EXISTS audience_demographics JSONB NOT NULL DEFAULT '{}'::jsonb
    `)
    results.push({ name: 'influencer_profiles.audience_demographics', status: 'added' })

    return NextResponse.json({
      success: true,
      message: 'Migration 024 completed: influencer onboarding wizard schema additions',
      results,
    })
  } catch (error) {
    console.error('[Migration 024] Error:', error)
    return NextResponse.json(
      {
        error: 'Migration 024 failed',
        details: error instanceof Error ? error.message : String(error),
        completedSteps: results,
      },
      { status: 500 },
    )
  }
}
