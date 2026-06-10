import { NextRequest, NextResponse } from 'next/server'
import { pgClient } from '@/db'

/**
 * Run migration 027: user_profiles FK CASCADE → users(id)
 * POST /api/admin/run-migration-027
 * Header: x-api-key: <ADMIN_API_KEY>
 *
 * Background:
 *   user_profiles.id was declared as a plain primary key with the
 *   comment "Will match user ID from auth" — but no actual FK to
 *   users(id). Deleting a users row therefore left an orphaned
 *   user_profiles row. ensureUserProfile's non-destructive
 *   reconciliation then re-attached the orphan to the next signup
 *   for the same email, silently carrying over onboarding_complete /
 *   demographics / interests — which made deliberate test-account
 *   resets impossible and (more importantly) left PII / consent data
 *   for "deleted" users in the DB.
 *
 * Steps (all idempotent):
 *   1. DELETE orphans — user_profiles rows whose id has no matching
 *      users row. These are leaks from prior deletions; cascade only
 *      starts protecting AFTER this migration runs.
 *   2. ADD CONSTRAINT user_profiles_id_users_fkey FOREIGN KEY (id)
 *      REFERENCES users(id) ON DELETE CASCADE. DO-block check so
 *      re-runs are no-ops.
 *
 * After this migration, the Drizzle schema declaration
 * `.references(() => users.id, { onDelete: 'cascade' })` is the
 * source of truth; this route exists to retrofit it onto an existing
 * production DB without a full schema migration.
 *
 * Mirrors the migration-011 pattern (Deals/Community FK CASCADE
 * hardening — orphan cleanup THEN add FK).
 */
export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key')
  if (!process.env.ADMIN_API_KEY || apiKey !== process.env.ADMIN_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: { name: string; status: string; affected?: number }[] = []

  try {
    // ── 1. Orphan cleanup ─────────────────────────────────────────
    // Adding the FK would fail if any user_profiles.id has no
    // matching users.id. Clean those up first. Also forward-fixes
    // the GDPR-adjacent leak where "deleted" users left behind
    // their demographics / interests / consent rows.
    const orphanDelete = await pgClient.unsafe<{ count: string }[]>(`
      WITH deleted AS (
        DELETE FROM user_profiles
          WHERE id NOT IN (SELECT id FROM users)
          RETURNING 1
      )
      SELECT COUNT(*)::text AS count FROM deleted
    `)
    results.push({
      name: 'cleanup orphan user_profiles (no matching users row)',
      status: 'done',
      affected: Number(orphanDelete?.[0]?.count ?? 0),
    })

    // ── 2. Add FK CASCADE ─────────────────────────────────────────
    // DO-block so re-runs don't fail with "constraint already exists".
    // Same pattern as migrations 011 / 021 / 026.
    await pgClient.unsafe(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'user_profiles_id_users_fkey'
        ) THEN
          ALTER TABLE user_profiles
            ADD CONSTRAINT user_profiles_id_users_fkey
            FOREIGN KEY (id) REFERENCES users(id) ON DELETE CASCADE;
        END IF;
      END $$
    `)
    results.push({ name: 'user_profiles_id_users_fkey', status: 'ensured' })

    return NextResponse.json({
      success: true,
      message:
        'Migration 027 completed: user_profiles orphans cleaned + FK CASCADE → users(id) ensured',
      results,
    })
  } catch (error) {
    console.error('[Migration 027] Error:', error)
    return NextResponse.json(
      {
        error: 'Migration 027 failed',
        details: error instanceof Error ? error.message : String(error),
        completedSteps: results,
      },
      { status: 500 },
    )
  }
}
