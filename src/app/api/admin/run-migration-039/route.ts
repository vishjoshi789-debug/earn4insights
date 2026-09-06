import { NextRequest, NextResponse } from 'next/server'
import { pgClient } from '@/db'

/**
 * Run migration 039: challenges.target_count — no default, minimum 2.
 *
 * WHY
 * ---
 * `target_count` defaulted to 1 (schema.ts). Any challenge row created without
 * an explicit target therefore completed on the user's FIRST qualifying action,
 * because advanceChallenges tests `1 >= challenge.targetCount`.
 *
 * Observed in production: a real consumer created an account at 19:26 and by
 * 19:37 held 849 points — 700 of them from THREE challenge_complete awards
 * (50 + 500 + 150). Two fired 40ms apart, on the account's FIRST feedback
 * submission. A brand-new account could take 550 points (₹55) for submitting
 * one piece of feedback.
 *
 * Platform-wide this made challenges 77% of ALL points ever awarded (2,560 of
 * 3,306) against 475 for feedback_submit — the reward system paying
 * overwhelmingly for something other than the contribution the platform exists
 * to collect.
 *
 * WHAT
 * ----
 * 1. Raise every existing target_count < 2 to 2 (required before the CHECK can
 *    be added, and the actual data fix).
 * 2. DROP the DEFAULT. A challenge's target is a deliberate design decision;
 *    inheriting 1 silently is what caused this. With no default, both Postgres
 *    and Drizzle force the author to state it.
 * 3. CHECK (target_count >= 2). A challenge completable in one action is not a
 *    challenge — it is a signup bonus with extra steps.
 *
 * ⚠️ THIS CHANGES PRODUCTION DATA. Existing challenges with target_count = 1
 * become 2, so they now require two actions. Users who ALREADY completed one
 * keep their completion — user_challenge_progress rows are untouched and
 * `completed` stays true. Nobody loses points they were awarded; the founder's
 * standing decision is fix-forward, never claw back.
 *
 * ⚠️ Does NOT rebalance point_reward values. The 500-point challenge is still
 * 20x a feedback submission; it just now takes two actions instead of one.
 * Rebalancing is a separate policy decision — see SESSION_RESUME.
 *
 * Ordering: SAFE EITHER WAY. Widening a value and adding a CHECK breaks no
 * existing SELECT, and the code change (one-completion-per-action) is
 * independent of it.
 */
export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key')
  if (!process.env.ADMIN_API_KEY || apiKey !== process.env.ADMIN_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: { name: string; status: string }[] = []

  try {
    // ── 1. Data fix FIRST — the CHECK cannot be added over violating rows ──
    const raised = await pgClient.unsafe(`
      UPDATE challenges
         SET target_count = 2
       WHERE target_count < 2
      RETURNING id, title, target_count, points_reward;
    `)
    results.push({
      name: 'challenges.target_count < 2 raised to 2',
      status: `updated ${raised.length}`,
    })

    // ── 2. Drop the default ───────────────────────────────────────
    await pgClient.unsafe(`
      ALTER TABLE challenges ALTER COLUMN target_count DROP DEFAULT;
    `)
    results.push({ name: 'challenges.target_count DROP DEFAULT', status: 'ensured' })

    // ── 3. Minimum of 2 ───────────────────────────────────────────
    await pgClient.unsafe(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'chk_challenges_target_count_min'
        ) THEN
          ALTER TABLE challenges
            ADD CONSTRAINT chk_challenges_target_count_min
            CHECK (target_count >= 2);
        END IF;
      END $$;
    `)
    results.push({ name: 'chk_challenges_target_count_min', status: 'ensured' })

    // ── Coverage line ─────────────────────────────────────────────
    // Reports the reward-to-effort ratio per challenge, which is the number
    // the rebalancing decision turns on: points_reward vs what the required
    // actions themselves pay.
    const state = await pgClient.unsafe(`
      SELECT id, title, source_type, target_count, points_reward, is_active
      FROM challenges
      ORDER BY points_reward DESC;
    `)

    return NextResponse.json({
      ok: true,
      message: 'Migration 039 completed: challenges.target_count >= 2, no default',
      results,
      challenges: state,
      detail:
        `${state.length} challenge(s) total; ${raised.length} had target_count < 2 and were raised to 2. ` +
        'Point rewards NOT rebalanced — separate decision.',
    })
  } catch (error: any) {
    console.error('[Migration039]', error)
    return NextResponse.json({ ok: false, error: error.message, results }, { status: 500 })
  }
}
