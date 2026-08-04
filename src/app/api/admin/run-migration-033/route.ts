import { NextRequest, NextResponse } from 'next/server'
import { pgClient } from '@/db'

/**
 * Run migration 033: link feedback to users.
 * POST /api/admin/run-migration-033
 * Header: x-api-key: <ADMIN_API_KEY>
 *
 * WHY: `feedback` stored only free-text `user_name` / `user_email` with no
 * user_id, so the consumer who submitted it was never linked to their account.
 * That blocked three separate things at once:
 *   1. GDPR erasure — migration 031's on-delete policy could not reach feedback
 *      (there was no FK), so `process-deletions` resorted to hard-DELETEing
 *      rows matched on email.
 *   2. Demographic filtering — the only join to user_profiles was a fragile
 *      email string match (see lib/analytics/segmentedAnalytics.ts).
 *   3. The resolution loop — notifying the consumer when a brand addresses
 *      their feedback is impossible without knowing who they are.
 *
 * ── ON DELETE SET NULL, deviating from 031's PII→CASCADE rule ──────────────
 * 031's triage says "CASCADE: PII/operational". Feedback text is consumer PII,
 * so the rule points at CASCADE. **We deliberately use SET NULL instead, and
 * this deviation is founder-approved — do NOT "consistency-fix" it back.**
 *
 * Reason: feedback is analytics data a brand paid to collect. CASCADE would
 * destroy it on one consumer's erasure request. Worse, `user_email` on
 * imported rows has historically held the IMPORTING BRAND's address (see the
 * import fix shipped alongside this), so a CASCADE keyed off that user would
 * delete third-party feedback that merely inherited their email.
 *
 * SET NULL has direct precedent in 031 under "analytics (retain anonymised)":
 * user_events.user_id, analytics_events.user_id, products.owner_id.
 *
 * ⚠️ SET NULL alone is NOT sufficient for erasure — `user_name` / `user_email`
 * remain on the row as plain text. `process-deletions` scrubs those; the FK
 * only severs the account link. Both halves are required.
 *
 * ── Backfill is PROVENANCE-AWARE, not a plain email join ───────────────────
 * A naive `SET user_id = (SELECT id FROM users WHERE email = user_email)`
 * would MIS-ATTRIBUTE imported feedback to the importing brand: before the
 * accompanying fix, `api/import/csv` fell back to `session.user.email` when a
 * CSV had no email column. In production that put the brand's own address on
 * all 18 imported rows. Backfilling those would make the brand the author of
 * third-party feedback on its own product, feed the brand's demographics into
 * consumer segmentation, and (once the resolution loop ships) notify the brand
 * that its own feedback was addressed.
 *
 * So we backfill ONLY organic rows — `multimodal_metadata->>'importSource' IS
 * NULL`. Imported rows stay NULL, which is the truthful answer: those
 * respondents are not platform users and never will be.
 *
 * Idempotent: ADD COLUMN IF NOT EXISTS, guarded constraint creation, CREATE
 * INDEX IF NOT EXISTS, and the backfill is scoped `WHERE user_id IS NULL` so
 * re-running is a no-op. No BEGIN/COMMIT (pooled connection). Deletes nothing.
 *
 * NEVER add NOT NULL: imported and webhook-ingested feedback legitimately has
 * no platform user, and import is the core beta wedge — NULL is the dominant
 * case, not an edge case.
 *
 * ROLLBACK:
 *   ALTER TABLE feedback DROP CONSTRAINT IF EXISTS fk_feedback_user;
 *   DROP INDEX IF EXISTS idx_feedback_user_id;
 *   ALTER TABLE feedback DROP COLUMN IF EXISTS user_id;
 */
export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key')
  if (!process.env.ADMIN_API_KEY || apiKey !== process.env.ADMIN_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: { step: string; status: string; detail?: string }[] = []

  try {
    // ── 1. Nullable user_id column ────────────────────────────────────────
    await pgClient.unsafe(`
      ALTER TABLE feedback ADD COLUMN IF NOT EXISTS user_id TEXT;
    `)
    results.push({ step: 'add feedback.user_id (nullable)', status: 'ensured' })

    // ── 2. Provenance-aware backfill — ORGANIC ROWS ONLY ──────────────────
    // Case-insensitive + trimmed to match how emails are stored elsewhere.
    // Scoped to user_id IS NULL so re-runs are no-ops and never overwrite a
    // value set by application code.
    const backfill = await pgClient.unsafe(`
      UPDATE feedback f
      SET user_id = u.id
      FROM users u
      WHERE f.user_id IS NULL
        AND f.multimodal_metadata->>'importSource' IS NULL
        AND f.user_email IS NOT NULL
        AND btrim(f.user_email) <> ''
        AND lower(btrim(f.user_email)) = lower(u.email);
    `)
    results.push({
      step: 'backfill user_id (organic rows only — imports intentionally left NULL)',
      status: 'done',
      detail: `${(backfill as unknown as { count?: number })?.count ?? 'n/a'} row(s) linked`,
    })

    // ── 3. FK with ON DELETE SET NULL (see rationale above) ───────────────
    await pgClient.unsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'fk_feedback_user'
        ) THEN
          ALTER TABLE feedback
            ADD CONSTRAINT fk_feedback_user
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
        END IF;
      END $$;
    `)
    results.push({ step: 'add fk_feedback_user (ON DELETE SET NULL)', status: 'ensured' })

    // ── 4. Index — supports "my feedback", the resolution loop, and the
    //      demographic join that previously went through email. ───────────
    await pgClient.unsafe(`
      CREATE INDEX IF NOT EXISTS idx_feedback_user_id
        ON feedback (user_id) WHERE user_id IS NOT NULL;
    `)
    results.push({ step: 'create idx_feedback_user_id (partial)', status: 'ensured' })

    // ── 5. Report coverage so the operator can sanity-check the split ─────
    const coverage = await pgClient.unsafe(`
      SELECT
        count(*)::int                                        AS total,
        count(user_id)::int                                  AS linked,
        count(*) FILTER (
          WHERE multimodal_metadata->>'importSource' IS NOT NULL
        )::int                                               AS imported
      FROM feedback;
    `)
    const row = (coverage as unknown as Array<Record<string, number>>)[0]
    results.push({
      step: 'coverage',
      status: 'ok',
      detail: `total=${row?.total} linked=${row?.linked} imported=${row?.imported} (imported are expected to stay NULL)`,
    })

    return NextResponse.json({ ok: true, migration: '033', results })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err), results },
      { status: 500 },
    )
  }
}
