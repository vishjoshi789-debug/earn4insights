import { NextRequest, NextResponse } from 'next/server'
import { pgClient } from '@/db'

/**
 * Run migration 023: Expand users.role CHECK constraint to include 'influencer'
 * POST /api/admin/run-migration-023
 * Header: x-api-key: <ADMIN_API_KEY>
 *
 * Hot-fix companion to migration 022 (Phase 3.5A).
 *
 * Background:
 *   Production had a `users_role_check` CHECK constraint with the
 *   allowlist ('brand', 'consumer', 'admin') that did NOT live in
 *   src/db/schema.ts — it must have been added directly in Neon at
 *   some prior point (the audit fix-log's mid-work item #14 actually
 *   noted that no CHECK existed; reality on prod differed).
 *
 *   When 3.5B introduced influencer as a self-assignable signup role,
 *   the first influencer signup attempt failed with:
 *     "new row for relation 'users' violates check constraint
 *      users_role_check"
 *
 *   This migration captures the constraint expansion in code so it
 *   replays cleanly on any future env (staging, disaster recovery,
 *   dev DB clones). The same Neon SQL was run by hand on prod to
 *   unblock 3.5B smoke; running this route on prod afterwards is a
 *   no-op (drop-if-exists + recreate with the same definition).
 *
 * What it does:
 *   1. DROP CONSTRAINT IF EXISTS users_role_check — safe no-op if
 *      the constraint never existed
 *   2. ADD CONSTRAINT users_role_check
 *        CHECK (role IN ('brand', 'consumer', 'influencer', 'admin'))
 *
 *   Pure additive on the value space — every existing role value
 *   ('brand', 'consumer', 'admin') stays valid; 'influencer' becomes
 *   accepted alongside them.
 *
 * Idempotency:
 *   The DROP uses IF EXISTS. The ADD is safe because we just dropped
 *   any prior definition. Re-running on a constraint that already has
 *   this definition just drops + recreates with the same shape.
 */
export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key')
  if (!process.env.ADMIN_API_KEY || apiKey !== process.env.ADMIN_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: { name: string; status: string; previousDefinition?: string | null }[] = []

  try {
    // Capture the previous definition (if any) for audit clarity.
    // This lets the response prove what was replaced — useful when
    // running on staging or DR clones where the prior shape may
    // differ from production.
    const priorRows = await pgClient.unsafe<{ definition: string }[]>(`
      SELECT pg_get_constraintdef(oid) AS definition
      FROM pg_constraint
      WHERE conname = 'users_role_check'
        AND conrelid = 'users'::regclass
      LIMIT 1
    `)
    const previousDefinition = priorRows?.[0]?.definition ?? null

    // Drop any existing CHECK constraint by that name. Safe no-op when
    // absent. Different envs may or may not have it depending on
    // history (prod did; some dev DBs won't).
    await pgClient.unsafe(`
      ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check
    `)
    results.push({
      name: 'drop users_role_check (if exists)',
      status: 'done',
      previousDefinition,
    })

    // Recreate with the expanded allowlist. Influencer is now a
    // first-class role alongside brand/consumer/admin.
    await pgClient.unsafe(`
      ALTER TABLE users
        ADD CONSTRAINT users_role_check
        CHECK (role IN ('brand', 'consumer', 'influencer', 'admin'))
    `)
    results.push({
      name: 'add users_role_check (brand, consumer, influencer, admin)',
      status: 'done',
    })

    return NextResponse.json({
      success: true,
      message: 'Migration 023 completed: users.role CHECK constraint expanded for influencer',
      results,
    })
  } catch (error) {
    console.error('[Migration 023] Error:', error)
    return NextResponse.json(
      {
        error: 'Migration 023 failed',
        details: error instanceof Error ? error.message : String(error),
        completedSteps: results,
      },
      { status: 500 },
    )
  }
}
