import { NextRequest, NextResponse } from 'next/server'
import { pgClient } from '@/db'

/**
 * Run migration 013: Backfill ownerId for orphaned products
 * POST /api/admin/run-migration-013
 * Header: x-api-key: <ADMIN_API_KEY>
 *
 * Background:
 *   Before commit 99925e3 (May 2026), src/app/dashboard/launch/launch.actions.ts
 *   created products without setting ownerId. Result: products are
 *   invisible in their brand's "My Products" / ICP / Feature Insights
 *   dropdowns because all those queries filter by ownerId = userId.
 *
 * Strategy (in order of preference):
 *   1. owner_id = created_by (set by consumer placeholder flow + post-99925e3 launches)
 *   2. owner_id = claimed_by (set by /api/dashboard/products/claim flow)
 *   3. Leave NULL — truly orphaned. Reported in `stillOrphaned` count for
 *      manual triage. These are products launched directly by brands before
 *      99925e3 without populated created_by / claimed_by — no recoverable
 *      owner data without manual intervention.
 *
 * Idempotent: only updates rows where owner_id IS NULL. Safe to re-run.
 */
export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key')
  if (!process.env.ADMIN_API_KEY || apiKey !== process.env.ADMIN_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Pre-check: count orphans
    const orphansBefore = (await pgClient.unsafe(
      `SELECT COUNT(*)::int AS count FROM products WHERE owner_id IS NULL`
    )) as Array<{ count: number }>
    const totalOrphansAtStart = orphansBefore[0]?.count ?? 0

    // ⚠️⚠️ `AND claimable = false` ADDED 2026-10-01 TO BOTH STATEMENTS.
    //
    // This route is a RE-RUNNABLE maintenance script, not a historical record, so
    // it has to be correct for FUTURE runs — which is why editing it is right here
    // and would be wrong for an ordinary migration.
    //
    // Without the guard, either UPDATE could hand an owner to a product that is
    // still `claimable = true`, violating
    // `products_claimable_implies_unowned`. ⚠️ And this route is NOT transactional
    // — four separate `pgClient.unsafe()` calls, and §5 forbids BEGIN/COMMIT on the
    // pooled connection — so a violation on Step 2 would leave Step 1 COMMITTED:
    // a failed migration AND partial data, which is worse than either alone.
    // Guarding both statements makes the violation unreachable, which is better
    // than making the failure atomic.
    //
    // It currently matches nothing extra: every `claimable = true` row has
    // `created_by IS NULL` because the placeholder UI posts `{ name }` only. The
    // reachable path was `/api/products/placeholder` accepting `createdBy` from the
    // request body — now removed. Both halves fixed.

    // Step 1: backfill from created_by where available
    const fromCreatedBy = (await pgClient.unsafe(`
      UPDATE products
      SET owner_id = created_by, updated_at = NOW()
      WHERE owner_id IS NULL AND created_by IS NOT NULL AND claimable = false
      RETURNING id, name, owner_id
    `)) as Array<{ id: string; name: string; owner_id: string }>

    // Step 2: backfill from claimed_by for any still-orphaned products
    const fromClaimedBy = (await pgClient.unsafe(`
      UPDATE products
      SET owner_id = claimed_by, updated_at = NOW()
      WHERE owner_id IS NULL AND claimed_by IS NOT NULL AND claimable = false
      RETURNING id, name, owner_id
    `)) as Array<{ id: string; name: string; owner_id: string }>

    // Step 3: count what's still orphaned
    const orphansAfter = (await pgClient.unsafe(
      `SELECT COUNT(*)::int AS count FROM products WHERE owner_id IS NULL`
    )) as Array<{ count: number }>
    const stillOrphaned = orphansAfter[0]?.count ?? 0

    return NextResponse.json({
      success: true,
      message: 'Migration 013 completed: backfilled product owner_id',
      results: {
        totalOrphansAtStart,
        backfilledFromCreatedBy: fromCreatedBy.length,
        backfilledFromClaimedBy: fromClaimedBy.length,
        stillOrphaned,
        sampleBackfilled: [
          ...fromCreatedBy.slice(0, 5).map((r) => ({ ...r, source: 'created_by' })),
          ...fromClaimedBy.slice(0, 5).map((r) => ({ ...r, source: 'claimed_by' })),
        ],
      },
    })
  } catch (error) {
    console.error('[Migration 013] Error:', error)
    return NextResponse.json(
      {
        error: 'Migration 013 failed',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
