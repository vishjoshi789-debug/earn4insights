import { NextRequest, NextResponse } from 'next/server'
import { pgClient } from '@/db'

/**
 * Run migration 036: brand_subscriptions parity + notification_preferences
 * constraint parity.
 * POST /api/admin/run-migration-036
 * Header: x-api-key: <ADMIN_API_KEY>
 *
 * WHY: both of these exist in the PRODUCTION database but not in any
 * numbered migration, so a database built from the migration routes alone —
 * which is exactly what a fresh preview/test environment is — would be
 * missing them. That would surface as confusing runtime failures rather than
 * an obvious "table not found" at setup time.
 *
 * ── 1. brand_subscriptions ────────────────────────────────────────────────
 * Created historically by `drizzle push`, then referenced by an FK in
 * migration 031 (which landed, so the table must exist in prod). It is the
 * only table of ~30 with no CREATE route. `getBrandSubscription` is called on
 * two live feedback pages, so its absence breaks brand feedback views.
 *
 * ── 2. notification_preferences UNIQUE(user_id, event_type) ───────────────
 * Migration 005 created this table WITH the constraint, so production is
 * fine — but `schema.ts` never declared it. `upsertPreference`'s
 * `onConflictDoUpdate` depends on it: Drizzle emits the ON CONFLICT target
 * from the column list and Postgres resolves it against the real constraint.
 * Without the constraint the upsert fails at runtime with "no unique or
 * exclusion constraint matching the ON CONFLICT specification" — and since
 * the settings UI shipped in the same wave, that would break every
 * preference save on any environment built without 005. Re-asserted here as
 * a no-op on prod and a safety net everywhere else.
 *
 * Idempotent: CREATE TABLE IF NOT EXISTS + a guarded constraint add. Additive,
 * no backfill, deletes nothing. No BEGIN/COMMIT (pooled connection).
 *
 * ⚠️ TWO-FILE change: this route AND `PUBLIC_API_ADMIN_PATHS` in middleware.
 *
 * ROLLBACK: none needed — both objects are expected to exist in every env.
 */
export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key')
  if (!process.env.ADMIN_API_KEY || apiKey !== process.env.ADMIN_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: { step: string; status: string; detail?: string }[] = []

  try {
    // ── 1. brand_subscriptions ────────────────────────────────────────────
    // Column list mirrors schema.ts:360 exactly. `brand_id` is UNIQUE (one
    // subscription per brand) and `id` is TEXT, not UUID — both match the
    // existing production table, which was created by drizzle push.
    await pgClient.unsafe(`
      CREATE TABLE IF NOT EXISTS brand_subscriptions (
        id                     TEXT PRIMARY KEY,
        brand_id               TEXT NOT NULL UNIQUE,
        tier                   TEXT NOT NULL DEFAULT 'free',
        status                 TEXT NOT NULL DEFAULT 'active',
        stripe_customer_id     TEXT,
        stripe_subscription_id TEXT,
        stripe_price_id        TEXT,
        current_period_start   TIMESTAMP,
        current_period_end     TIMESTAMP,
        cancel_at              TIMESTAMP,
        canceled_at            TIMESTAMP,
        trial_start            TIMESTAMP,
        trial_end              TIMESTAMP,
        created_at             TIMESTAMP NOT NULL DEFAULT now(),
        updated_at             TIMESTAMP NOT NULL DEFAULT now()
      );
    `)
    results.push({ step: 'create brand_subscriptions', status: 'ensured' })

    // `feature_overrides` is a per-brand grant blob read by
    // getBrandSubscription. Added separately so an older prod table that
    // predates the column still receives it.
    await pgClient.unsafe(`
      ALTER TABLE brand_subscriptions
        ADD COLUMN IF NOT EXISTS feature_overrides JSONB;
    `)
    results.push({ step: 'ensure brand_subscriptions.feature_overrides', status: 'ensured' })

    // ── 2. notification_preferences uniqueness ────────────────────────────
    await pgClient.unsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'notification_preferences_user_id_event_type_key'
        ) AND NOT EXISTS (
          SELECT 1 FROM pg_indexes
          WHERE tablename = 'notification_preferences'
            AND indexdef ILIKE '%UNIQUE%(user_id, event_type)%'
        ) THEN
          ALTER TABLE notification_preferences
            ADD CONSTRAINT notification_preferences_user_id_event_type_key
            UNIQUE (user_id, event_type);
        END IF;
      END $$;
    `)
    results.push({
      step: 'ensure UNIQUE(user_id, event_type) on notification_preferences',
      status: 'ensured',
      detail: 'no-op on production (migration 005 created it); safety net for fresh envs',
    })

    // ── 3. Report ─────────────────────────────────────────────────────────
    const state = await pgClient.unsafe(`
      SELECT
        (SELECT count(*)::int FROM brand_subscriptions)                       AS subscriptions,
        (SELECT count(*)::int FROM notification_preferences)                  AS saved_preferences,
        (SELECT count(*)::int FROM pg_constraint
          WHERE conname = 'notification_preferences_user_id_event_type_key')  AS uniq_constraint;
    `)
    const row = (state as unknown as Array<Record<string, number>>)[0]
    results.push({
      step: 'state',
      status: 'ok',
      detail:
        `brand_subscriptions=${row?.subscriptions} ` +
        `saved_preferences=${row?.saved_preferences} ` +
        `uniq_constraint_present=${(row?.uniq_constraint ?? 0) > 0}`,
    })

    return NextResponse.json({ ok: true, migration: '036', results })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err), results },
      { status: 500 },
    )
  }
}
