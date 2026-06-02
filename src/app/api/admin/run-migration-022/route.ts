import { NextRequest, NextResponse } from 'next/server'
import { pgClient } from '@/db'

/**
 * Run migration 022: Multi-role flags + influencer wizard completion (Phase 3.5A)
 * POST /api/admin/run-migration-022
 * Header: x-api-key: <ADMIN_API_KEY>
 *
 * Adds:
 *   - users.is_brand           BOOLEAN NOT NULL DEFAULT false
 *   - users.is_consumer        BOOLEAN NOT NULL DEFAULT false
 *     (users.is_influencer already exists from earlier migration)
 *   - Backfill: is_brand/is_consumer mirrored from existing users.role
 *
 *   - influencer_profiles.onboarding_completed     BOOLEAN NOT NULL DEFAULT false
 *   - influencer_profiles.onboarding_completed_at  TIMESTAMP
 *
 *   - Partial index idx_influencer_pending_onboarding on influencer_profiles
 *     (user_id) WHERE onboarding_completed = false — drives the
 *     "needs-wizard banner" lookup so we don't scan completed rows
 *
 * The boolean flags coexist with the existing single-valued users.role:
 *   - users.role = primary view / default dashboard
 *     ('brand' | 'consumer' | 'influencer' | 'admin')
 *   - users.is_brand / is_consumer / is_influencer = cross-cutting capability
 *     flags. A dual-role user has multiple = true; existing role==='X' checks
 *     in the codebase keep working unchanged
 *
 * Grandfathered influencers: existing influencer_profiles rows default to
 * onboarding_completed = false on purpose. Phase 3.5G ships a dismissable
 * banner ("we've improved the setup — take 2 minutes to redo your profile")
 * that NEVER force-redirects them. The default-false catches them in the
 * banner gate; their existing profile + earnings are untouched.
 *
 * Idempotent: ADD COLUMN IF NOT EXISTS + UPDATE WHERE + CREATE INDEX IF NOT
 * EXISTS throughout. Safe to re-run.
 */
export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key')
  if (!process.env.ADMIN_API_KEY || apiKey !== process.env.ADMIN_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: { name: string; status: string; affected?: number }[] = []

  try {
    // ── users.is_brand ────────────────────────────────────────────
    await pgClient.unsafe(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS is_brand BOOLEAN NOT NULL DEFAULT false
    `)
    results.push({ name: 'users.is_brand', status: 'added' })

    // ── users.is_consumer ─────────────────────────────────────────
    await pgClient.unsafe(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS is_consumer BOOLEAN NOT NULL DEFAULT false
    `)
    results.push({ name: 'users.is_consumer', status: 'added' })

    // ── Backfill from existing role ───────────────────────────────
    // UPDATE … WHERE role = 'brand' AND is_brand = false makes the
    // backfill itself idempotent — re-running on a populated DB is a
    // no-op rather than a thrash-write.
    const brandsBackfilled = await pgClient.unsafe<{ count: string }[]>(`
      WITH updated AS (
        UPDATE users
          SET is_brand = true
          WHERE role = 'brand' AND is_brand = false
          RETURNING 1
      )
      SELECT COUNT(*)::text AS count FROM updated
    `)
    results.push({
      name: 'backfill is_brand WHERE role=brand',
      status: 'done',
      affected: Number(brandsBackfilled?.[0]?.count ?? 0),
    })

    const consumersBackfilled = await pgClient.unsafe<{ count: string }[]>(`
      WITH updated AS (
        UPDATE users
          SET is_consumer = true
          WHERE role = 'consumer' AND is_consumer = false
          RETURNING 1
      )
      SELECT COUNT(*)::text AS count FROM updated
    `)
    results.push({
      name: 'backfill is_consumer WHERE role=consumer',
      status: 'done',
      affected: Number(consumersBackfilled?.[0]?.count ?? 0),
    })

    // is_influencer is already populated by registerAsInfluencer; no
    // backfill needed. Documented here so future Claude sessions don't
    // wonder.

    // ── influencer_profiles.onboarding_completed ──────────────────
    await pgClient.unsafe(`
      ALTER TABLE influencer_profiles
        ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT false
    `)
    results.push({ name: 'influencer_profiles.onboarding_completed', status: 'added' })

    await pgClient.unsafe(`
      ALTER TABLE influencer_profiles
        ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMP
    `)
    results.push({ name: 'influencer_profiles.onboarding_completed_at', status: 'added' })

    // ── Partial index for "needs wizard" lookup ───────────────────
    await pgClient.unsafe(`
      CREATE INDEX IF NOT EXISTS idx_influencer_pending_onboarding
        ON influencer_profiles (user_id)
        WHERE onboarding_completed = false
    `)
    results.push({ name: 'idx_influencer_pending_onboarding', status: 'created' })

    return NextResponse.json({
      success: true,
      message: 'Migration 022 completed: multi-role flags + influencer wizard onboarding',
      results,
    })
  } catch (error) {
    console.error('[Migration 022] Error:', error)
    return NextResponse.json(
      {
        error: 'Migration 022 failed',
        details: error instanceof Error ? error.message : String(error),
        completedSteps: results,
      },
      { status: 500 },
    )
  }
}
