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

    // Step 1: backfill from created_by where available
    const fromCreatedBy = (await pgClient.unsafe(`
      UPDATE products
      SET owner_id = created_by, updated_at = NOW()
      WHERE owner_id IS NULL AND created_by IS NOT NULL
      RETURNING id, name, owner_id
    `)) as Array<{ id: string; name: string; owner_id: string }>

    // Step 2: backfill from claimed_by for any still-orphaned products
    const fromClaimedBy = (await pgClient.unsafe(`
      UPDATE products
      SET owner_id = claimed_by, updated_at = NOW()
      WHERE owner_id IS NULL AND claimed_by IS NOT NULL
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
