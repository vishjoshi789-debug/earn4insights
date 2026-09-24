import { NextRequest, NextResponse } from 'next/server'
import { pgClient } from '@/db'

/**
 * Run migration 043: contribution_events.scored_by + brand_reward_configs CHECKs.
 *
 * ⚠️⚠️ APPLY THE `scored_by` COLUMN VIA THE NEON CONSOLE BEFORE DEPLOYING.
 *
 * `api/contribution/intelligence/route.ts:37` does a bare
 * `db.select().from(contributionEvents)`, which Drizzle expands to every column
 * in schema.ts. The moment schema.ts declares `scoredBy`, that route asks
 * Postgres for a column that must already exist. Same sequence as 033, 034,
 * 041 and 042 — schema change FIRST, deploy second, this route third as an
 * idempotent confirming no-op.
 *
 * The CHECK constraints have no such ordering constraint and are safe either
 * way.
 *
 * ── 1. contribution_events.scored_by ─────────────────────────────
 *
 * Which scorer priced a contribution was only discoverable by testing whether
 * `quality_reasoning` began with the literal string "Heuristic: " — a text
 * prefix doing a column's job. It stopped being academic as soon as the data
 * was looked at: community_post and survey_complete both averaged EXACTLY 20.0
 * quality while feedback_submit varied at 45.4, which is the signature of a
 * fallback rather than of scoring. These scores multiply real, redeemable
 * points, so "what priced this payment" must be a fact, not an inference.
 *
 * Nullable, no default, ON PURPOSE. Rows written before this migration
 * genuinely do not know which scorer ran, and defaulting them to 'ai' or
 * 'heuristic' would invent an answer for every historical row. NULL means
 * "not recorded", which is true. No backfill is possible for the same reason
 * the Resend delivery history could not be backfilled in 035.
 *
 * ── 2. brand_reward_configs CHECKs ───────────────────────────────
 *
 * `weight` and `bonus_multiplier` are both `real` with NO constraint —
 * migrations 029/030 added money CHECKs across the payment tables and never
 * covered this one. They multiply into:
 *
 *   final_tokens = base × quality × (weight × bonus_multiplier) × reputation
 *
 * which credits redeemable points at 10 pts = ₹1, funded entirely by the
 * platform — `brand_reward_configs` has no billing link, so nobody is charged
 * for the bonus. A brand writing `weight: 100` multiplied the platform's own
 * payout by 100. `POST /api/contribution/brand-config` is reachable by any
 * authenticated brand; it has no UI, and "no UI" is not a control.
 *
 * ⚠️ The CHECK ceiling is deliberately WIDER than the application clamp.
 * `getBrandWeight()` clamps the effective product to MAX_BRAND_WEIGHT = 1.0 as
 * a security stopgap while the founder decides the real cap. The constraint is
 * the outer backstop against absurd values (and against a future clamp being
 * removed); the clamp is today's policy. Setting the CHECK to 1.0 as well
 * would mean re-running a migration the moment the cap is raised.
 *
 * Existing rows: the founder reported brand weight has never been set, so
 * brand_reward_configs is expected to be empty and neither constraint should
 * fail on adoption. ⚠️ NOT independently verified by query — if ADD CONSTRAINT
 * fails, a row exists outside the range and that row is itself the finding.
 * Re-run after inspecting it rather than widening the CHECK to accommodate it.
 */
export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key')
  if (!process.env.ADMIN_API_KEY || apiKey !== process.env.ADMIN_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await pgClient.unsafe(`
      ALTER TABLE contribution_events
        ADD COLUMN IF NOT EXISTS scored_by text;
    `)

    // Idempotent: DO $$ guards because ADD CONSTRAINT has no IF NOT EXISTS.
    await pgClient.unsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'brand_reward_configs_weight_range'
        ) THEN
          ALTER TABLE brand_reward_configs
            ADD CONSTRAINT brand_reward_configs_weight_range
            CHECK (weight >= 0 AND weight <= 10);
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'brand_reward_configs_bonus_range'
        ) THEN
          ALTER TABLE brand_reward_configs
            ADD CONSTRAINT brand_reward_configs_bonus_range
            CHECK (bonus_multiplier IS NULL OR (bonus_multiplier >= 0 AND bonus_multiplier <= 10));
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'contribution_events_scored_by_values'
        ) THEN
          ALTER TABLE contribution_events
            ADD CONSTRAINT contribution_events_scored_by_values
            CHECK (scored_by IS NULL OR scored_by IN ('ai', 'heuristic'));
        END IF;
      END $$;
    `)

    const [coverage] = await pgClient.unsafe(`
      SELECT count(*)::int AS total_events,
             count(*) FILTER (WHERE scored_by IS NULL)::int AS scorer_unrecorded,
             count(*) FILTER (WHERE scored_by = 'ai')::int AS scored_ai,
             count(*) FILTER (WHERE scored_by = 'heuristic')::int AS scored_heuristic,
             count(*) FILTER (WHERE status = 'pending')::int AS stranded_pending,
             count(*) FILTER (WHERE status = 'scored')::int AS stranded_scored
      FROM contribution_events;
    `)

    const [configs] = await pgClient.unsafe(`
      SELECT count(*)::int AS total_configs,
             coalesce(max(weight), 0)::real AS max_weight,
             coalesce(max(bonus_multiplier), 0)::real AS max_bonus
      FROM brand_reward_configs;
    `)

    return NextResponse.json({
      ok: true,
      message: 'Migration 043 completed: contribution_events.scored_by + brand_reward_configs CHECKs',
      coverage,
      configs,
      detail:
        'scorer_unrecorded is every row written before this migration — not backfillable, ' +
        'because which scorer ran was never stored. stranded_pending and stranded_scored are ' +
        'contributions that died mid-pipeline: nothing retries them and nothing surfaces them.',
    })
  } catch (error: any) {
    console.error('[Migration043]', error)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
