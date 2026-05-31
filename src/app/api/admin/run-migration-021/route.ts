import { NextRequest, NextResponse } from 'next/server'
import { pgClient } from '@/db'

/**
 * Run migration 021: Brand Onboarding (brand_profiles table)
 * POST /api/admin/run-migration-021
 * Header: x-api-key: <ADMIN_API_KEY>
 *
 * Adds a single table `brand_profiles` capturing company-level fields
 * collected during the 5-step brand onboarding wizard:
 *
 *   - Company basics (name, industry, size, website, description)
 *   - Primary contact (name, role, phone)
 *   - Billing (entity, address JSON, GSTIN — all optional)
 *   - Brand assets (logo URL, target audience JSON)
 *   - Onboarding lifecycle (onboarding_completed flag)
 *
 * Separate table (not user_profiles) so consumer profile schema
 * evolution doesn't churn brand data and vice versa. FK CASCADE to
 * users so account deletion (GDPR Art. 17) cleans up brand_profiles.
 *
 * Indexes:
 *   - UNIQUE on user_id (one brand_profiles row per user)
 *   - Partial index on (user_id) WHERE onboarding_completed = false
 *     to make the "show me brands needing the backfill banner" query
 *     cheap.
 *
 * Idempotent: CREATE TABLE IF NOT EXISTS + DO-block FK constraint
 * existence check + CREATE INDEX IF NOT EXISTS throughout.
 */
export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key')
  if (!process.env.ADMIN_API_KEY || apiKey !== process.env.ADMIN_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: { name: string; status: string }[] = []

  try {
    await pgClient.unsafe(`
      CREATE TABLE IF NOT EXISTS brand_profiles (
        id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id                  TEXT NOT NULL UNIQUE,

        -- Company basics (step 2)
        company_name             TEXT NOT NULL,
        industry                 TEXT NOT NULL,
        company_size             TEXT,
        website                  TEXT,
        description              TEXT,

        -- Primary contact (step 3)
        primary_contact_name     TEXT,
        primary_contact_role     TEXT,
        primary_contact_phone    TEXT,

        -- Billing (step 4, optional)
        billing_entity           TEXT,
        billing_address          JSONB,
        billing_gstin            TEXT,

        -- Brand assets + targeting (step 5)
        brand_logo_url           TEXT,
        target_audience          JSONB,

        -- Lifecycle
        onboarding_completed     BOOLEAN NOT NULL DEFAULT false,
        onboarding_completed_at  TIMESTAMP,
        created_at               TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at               TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `)
    results.push({ name: 'brand_profiles', status: 'created' })

    // FK CASCADE → users(id). Wrapped in DO-block so re-runs don't fail
    // with "constraint already exists". Same pattern as migration 011.
    await pgClient.unsafe(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'fk_brand_profiles_user'
        ) THEN
          ALTER TABLE brand_profiles
            ADD CONSTRAINT fk_brand_profiles_user
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
        END IF;
      END $$
    `)
    results.push({ name: 'fk_brand_profiles_user', status: 'ensured' })

    // Partial index — drives the "needs-onboarding banner" lookup so
    // we don't scan completed rows for every brand dashboard render.
    await pgClient.unsafe(`
      CREATE INDEX IF NOT EXISTS idx_brand_profiles_pending
        ON brand_profiles (user_id)
        WHERE onboarding_completed = false
    `)
    results.push({ name: 'idx_brand_profiles_pending', status: 'created' })

    return NextResponse.json({
      success: true,
      message: 'Migration 021 completed: brand_profiles',
      results,
    })
  } catch (error) {
    console.error('[Migration 021] Error:', error)
    return NextResponse.json(
      {
        error: 'Migration 021 failed',
        details: error instanceof Error ? error.message : String(error),
        completedSteps: results,
      },
      { status: 500 },
    )
  }
}
