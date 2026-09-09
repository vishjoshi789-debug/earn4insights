import { NextRequest, NextResponse } from 'next/server'
import { pgClient } from '@/db'

/**
 * Run migration 040: challenge economics — rebalance rewards, rename two
 * challenges that promised something unenforceable, retire one.
 *
 * SEPARATE FROM 039 ON PURPOSE. 039 is structural (target_count >= 2, no
 * default) and permanent. This is POLICY, and policy changes again — the next
 * retune is 041, and it must not rewrite the migration that owns the
 * constraint. It also touches live in-progress rows, so it needs its own
 * revert path.
 *
 * ORDERING: safe either way. Run after 039 and these values replace the
 * blanket `target_count = 2`; run before it and 039's `WHERE target_count < 2`
 * catches only First Feedback, which is disabled here anyway. Both orders end
 * in the same state.
 *
 * ── WHY ──────────────────────────────────────────────────────────
 *
 * Challenge rewards were 77% of ALL points ever awarded on the platform —
 * 2,560 of 3,306 credits — against 475 for feedback_submit, the contribution
 * the platform exists to collect. Measured, not estimated:
 *
 *   challenge_complete   2,560   12 txns   4 users
 *   feedback_submit        475   19 txns   4 users
 *
 * The base rates (feedback 25, survey 50, community_post 10, community_reply
 * 5) are proportioned to effort. The challenge rewards were set on a different
 * scale with no relationship to them — Video Reviewer paid 500 for a SINGLE
 * feedback submission, 20x the base action.
 *
 * ── THE RULE ─────────────────────────────────────────────────────
 *
 *   points_reward <= base_value * target_count
 *
 * A challenge can at most DOUBLE what the required work already earns, never
 * 20x it. It self-balances: a bigger reward demands more actions. All values
 * below sit at exactly 0.8x base, which is uniform and explainable.
 *
 * ⚠️ base_value EXCLUDES the media bonus (audio +20, video +20, image +5).
 * The media bonus and a challenge reward are the same instrument aimed at the
 * same behaviour — a video feedback already pays 45 vs 25 for text, so the
 * extra effort is priced once. Capping a 3-action video challenge against 45
 * would pay 135 on top of the 135 the work already earned: a second premium
 * for one signal.
 *
 * ── THE RENAME IS A FALSE-AFFORDANCE FIX, NOT COSMETICS ───────────
 *
 * ⚠️ "Video Reviewer" and "Photo Reviewer" were BOTH source_type='feedback',
 * and `sourceTypeMap` in pointsService collapses every submission to
 * 'feedback' with no media dimension at all. So a TEXT-ONLY submission
 * advanced both, and Video Reviewer paid 500 points for feedback that need
 * never have contained video. The names claimed behaviour no code enforced —
 * and unlike the alert toggles removed in a66114b, this one PAID OUT on the
 * false claim.
 *
 * Renamed to what is actually enforceable. Making it real would mean emitting
 * feedback_video / feedback_photo from `modalityPrimary` — a change to the
 * awarding path, deliberately not bundled here.
 *
 * ── FIRST FEEDBACK IS DISABLED, NOT DELETED ──────────────────────
 *
 * It is an onboarding bonus, not a repetition challenge, and at target_count=1
 * it cannot survive 039's CHECK as a "first" anything. Disabled via is_active,
 * which `advanceChallenges` and /api/challenges both filter on, so it vanishes
 * from awarding AND display. NOT deleted: user_challenge_progress.challenge_id
 * would be orphaned and the record that it ever existed would be lost.
 *
 * ── MATCHED BY ID, NOT TITLE ─────────────────────────────────────
 *
 * ⚠️ Two titles CHANGE in this very migration, so a title match would be
 * self-defeating on re-run. Ids are stable and were read from production.
 *
 * ── LIVE IMPACT, MEASURED BEFORE WRITING THIS ────────────────────
 *
 * 15 user_challenge_progress rows, 12 completed, 3 in progress. `completed` is
 * a stored boolean and is never recomputed, so NOBODY IS UN-COMPLETED and no
 * awarded points are touched — the standing decision is fix-forward, never
 * claw back.
 *
 * Of the 3 in-progress rows, NO TARGET IS RAISED (5->5, 5->5, 3->3), so no
 * goalposts move; only unearned future rewards shrink:
 *   - founder's own account: -50 and -80 points (~₹13, self-affecting)
 *   - one external user at 1/5 progress: -50 points (~₹5)
 * The target RAISES here (1->3 twice) affect nobody, because at target_count=1
 * those always completed instantly — confirmed by their absence from the
 * in-progress set.
 *
 * ── COST SHAPE ───────────────────────────────────────────────────
 *
 * A user completing all five now earns 344 points (~₹34.40), ONCE. Challenge
 * cost scales with USER ACQUISITION, not feedback volume — it is paid before
 * any brand pays us. To incentivise richer feedback, raise the MEDIA BONUS
 * instead: it fires on actual media presence and scales with value delivered.
 * Only 6 of 19 submissions to date carried any media.
 */
export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key')
  if (!process.env.ADMIN_API_KEY || apiKey !== process.env.ADMIN_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const before = await pgClient.unsafe(`
      SELECT id, title, source_type, target_count, points_reward, is_active
      FROM challenges ORDER BY title;
    `)

    // Video Reviewer -> Feedback Starter. 1/500 (20x base) -> 3/60 (0.8x).
    // The single largest defect: 500 points for one submission of any modality.
    const r1 = await pgClient.unsafe(`
      UPDATE challenges
         SET target_count = 3, points_reward = 60, title = 'Feedback Starter'
       WHERE id = '5921fc90-378c-4404-ac89-1462cd019031'
      RETURNING id, title, target_count, points_reward;
    `)

    // Photo Reviewer -> Feedback Regular. 5/150 -> 5/100. Target unchanged, so
    // the two users mid-progress here do not have to do more work.
    const r2 = await pgClient.unsafe(`
      UPDATE challenges
         SET target_count = 5, points_reward = 100, title = 'Feedback Regular'
       WHERE id = '95c31676-6435-4a3e-a9bf-80c35216059f'
      RETURNING id, title, target_count, points_reward;
    `)

    // Survey Champion. 3/200 -> 3/120. Base 50 * 3 * 0.8.
    const r3 = await pgClient.unsafe(`
      UPDATE challenges
         SET target_count = 3, points_reward = 120
       WHERE id = 'e1a67fee-154d-4ded-a94e-0f9e45cf89aa'
      RETURNING id, title, target_count, points_reward;
    `)

    // Community Starter. 1/30 -> 3/24. Was auto-completing on the first post.
    const r4 = await pgClient.unsafe(`
      UPDATE challenges
         SET target_count = 3, points_reward = 24
       WHERE id = '511d7539-d501-475b-a63b-ed95da1df58a'
      RETURNING id, title, target_count, points_reward;
    `)

    // Active Participant. 10/100 -> 10/40. Base 5 * 10 * 0.8.
    const r5 = await pgClient.unsafe(`
      UPDATE challenges
         SET target_count = 10, points_reward = 40
       WHERE id = '2fb678b5-3fd1-429d-a855-d22eefa91c20'
      RETURNING id, title, target_count, points_reward;
    `)

    // First Feedback — retired. Onboarding bonus, not a repetition challenge.
    const r6 = await pgClient.unsafe(`
      UPDATE challenges
         SET is_active = false
       WHERE id = '0e056f8e-915a-461c-98b8-5e2b388e2bf6'
      RETURNING id, title, is_active;
    `)

    const matched =
      r1.length + r2.length + r3.length + r4.length + r5.length + r6.length

    const after = await pgClient.unsafe(`
      SELECT id, title, source_type, target_count, points_reward, is_active,
             ROUND(points_reward::numeric / target_count, 1) AS reward_per_action
      FROM challenges
      ORDER BY is_active DESC, reward_per_action DESC;
    `)

    // Anything still paying above its base rate violates the rule. REPORTED,
    // not thrown — a hand-inserted row is a founder decision, not a 500. But
    // it must be visible, or the rule quietly stops being true.
    const overCap = await pgClient.unsafe(`
      SELECT c.title, c.source_type, c.target_count, c.points_reward,
             ROUND(c.points_reward::numeric / c.target_count, 1) AS reward_per_action
      FROM challenges c
      WHERE c.is_active
        AND c.points_reward::numeric / c.target_count > CASE c.source_type
              WHEN 'feedback'        THEN 25
              WHEN 'survey'          THEN 50
              WHEN 'community_post'  THEN 10
              WHEN 'community_reply' THEN 5
              ELSE 25 END;
    `)

    return NextResponse.json({
      ok: true,
      message: 'Migration 040 completed: challenge economics rebalanced',
      matched,
      expectedMatches: 6,
      before,
      after,
      overCap,
      detail:
        matched === 6
          ? 'All 6 challenge ids matched.'
          : `⚠️ ${matched}/6 ids matched — a challenge id changed or a row was deleted. Re-read the table before assuming this applied.`,
    })
  } catch (error: any) {
    console.error('[Migration040]', error)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
