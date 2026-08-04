import { NextRequest, NextResponse } from 'next/server'
import { pgClient } from '@/db'

/**
 * Run migration 034: the resolution loop.
 * POST /api/admin/run-migration-034
 * Header: x-api-key: <ADMIN_API_KEY>
 *
 * WHY: closing the "three-way connection" loop — a consumer submits feedback,
 * the brand is notified in real time, the brand marks it addressed, and until
 * now the consumer was never told. Migration 033 supplied the missing identity
 * (`feedback.user_id`); this supplies the delivery bookkeeping.
 *
 * ── 1. resolution_notified_at ──────────────────────────────────────────────
 * The idempotence key for "notify once per feedback item, ever".
 *
 * It is NOT a duplicate of `status`. Checking `status <> 'addressed'` in
 * application code races: two brand tabs, a double-click, or a retry all read
 * the pre-update value and each send a notification. Instead the status route
 * does a CONDITIONAL claim:
 *
 *     UPDATE feedback SET resolution_notified_at = now()
 *     WHERE id = $1 AND resolution_notified_at IS NULL
 *     RETURNING id
 *
 * and emits only if a row comes back — the same
 * claim-by-conditional-update pattern the scheduled-launch cron uses
 * (`WHERE launch_status = 'scheduled'`). A brand toggling
 * addressed -> new -> addressed therefore notifies exactly once, forever.
 *
 * It is also the only durable answer to "was this consumer ever told?".
 * `notification_inbox` cannot answer that: its rows carry `expires_at` and are
 * not written at all when the user has in-app notifications disabled.
 *
 * ── 2. resolution_note ─────────────────────────────────────────────────────
 * Added now, DELIBERATELY UNUSED IN V1. A short brand note ("fixed in the
 * latest update") is far more meaningful to a consumer than a generic
 * "addressed", and the copy is written with a slot for it, but it is held back
 * on purpose: it would be the first user-generated content travelling
 * BRAND -> CONSUMER, rendered both in-app and in email, and that needs a real
 * moderation design rather than a textarea. Founder-approved as Phase 2.
 *
 * Shipping the column now means Phase 2 is a UI-only change with no migration
 * and no deploy-ordering dance.
 *
 * Idempotent: ADD COLUMN IF NOT EXISTS only. Additive, nullable, no backfill,
 * no constraint, deletes nothing. No BEGIN/COMMIT (pooled connection).
 *
 * ⚠️ Adding a run-migration-NNN route is a TWO-FILE change: this file AND the
 * `PUBLIC_API_ADMIN_PATHS` allowlist in `src/middleware.ts`. Without the
 * allowlist entry middleware returns 401 before route resolution — a failure
 * indistinguishable from a wrong ADMIN_API_KEY. (033 shipped without it.)
 *
 * ROLLBACK:
 *   ALTER TABLE feedback DROP COLUMN IF EXISTS resolution_notified_at;
 *   ALTER TABLE feedback DROP COLUMN IF EXISTS resolution_note;
 */
export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key')
  if (!process.env.ADMIN_API_KEY || apiKey !== process.env.ADMIN_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: { step: string; status: string; detail?: string }[] = []

  try {
    // ── 1. Notification idempotence key ───────────────────────────────────
    await pgClient.unsafe(`
      ALTER TABLE feedback
        ADD COLUMN IF NOT EXISTS resolution_notified_at TIMESTAMP;
    `)
    results.push({ step: 'add feedback.resolution_notified_at', status: 'ensured' })

    // ── 2. Phase-2 slot for the brand's note (unused in v1) ───────────────
    await pgClient.unsafe(`
      ALTER TABLE feedback
        ADD COLUMN IF NOT EXISTS resolution_note TEXT;
    `)
    results.push({ step: 'add feedback.resolution_note (Phase 2, unused in v1)', status: 'ensured' })

    // ── 3. Report reachability so the operator knows what the loop can hit ─
    // The loop can only ever notify rows with a non-null user_id. Imported
    // rows are permanently NULL by design (their respondents are not platform
    // users), so `reachable` is the honest ceiling, not a coverage failure.
    const coverage = await pgClient.unsafe(`
      SELECT
        count(*)::int                                          AS total,
        count(user_id)::int                                    AS reachable,
        count(*) FILTER (WHERE status = 'addressed')::int      AS addressed,
        count(resolution_notified_at)::int                     AS already_notified
      FROM feedback;
    `)
    const row = (coverage as unknown as Array<Record<string, number>>)[0]
    results.push({
      step: 'reachability',
      status: 'ok',
      detail:
        `total=${row?.total} reachable=${row?.reachable} ` +
        `addressed=${row?.addressed} already_notified=${row?.already_notified} ` +
        `(unreachable rows are imported — NULL user_id by design)`,
    })

    return NextResponse.json({ ok: true, migration: '034', results })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err), results },
      { status: 500 },
    )
  }
}
