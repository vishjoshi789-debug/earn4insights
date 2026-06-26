import { NextRequest, NextResponse } from 'next/server'
import { pgClient } from '@/db'

/**
 * Run migration 031: Foreign-key integrity + GDPR-aware on-delete actions (B33).
 * POST /api/admin/run-migration-031
 * Header: x-api-key: <ADMIN_API_KEY>
 *
 * Adds the FKs the prod audit found missing, with on-delete actions chosen per
 * the agreed policy. SHIPS TOGETHER with the process-deletions cron rewrite —
 * the cron now relies on these FK actions to clean dependents.
 *
 * On-delete policy:
 *   CASCADE   PII/operational + owned children (delete with the parent)
 *   SET NULL  money/ledger history + analytics + admin-actor refs
 *             (rows retained, person-link severed = anonymised erasure)
 *   RESTRICT  reward_redemptions.reward_id (don't delete a catalog reward with history)
 *
 * SKIPPED (intentionally FK-less): external/opaque ids (razorpay/stripe/wise/
 * paypal/swift/google/upi/encryption_key), polymorphic refs (source_id /
 * *_entity_id / actor_id), social_posts.parent_post_id, community_poll_votes.
 * option_id, community_deals_flags.content_id, consumer_signal_snapshots.
 * triggered_by, user_events.notification_id, competitive_insights.generated_by
 * ('system'/'ai'/'manual' sentinel), audit_log.{user_id,accessed_by} (audit
 * trail decoupled from user lifecycle by design).
 *
 * Step 1 makes the 5 SET-NULL money/analytics user_id columns nullable
 * (DROP NOT NULL) so SET NULL can fire. Orphan audit returned 0 for every
 * target, so FK creation cannot fail on existing data.
 *
 * Idempotent: DROP NOT NULL is a no-op if already nullable; FK creation is
 * guarded on pg_constraint.conname. Safe to re-run. No BEGIN/COMMIT.
 *
 * ROLLBACK (run manually if needed):
 *   - Drop every FK:  the same conname list with
 *       ALTER TABLE <child> DROP CONSTRAINT IF EXISTS <conname>;
 *   - Re-adding the 5 NOT NULLs is only safe BEFORE any deletion has nulled
 *     rows (once SET NULL fires, nulls exist and NOT NULL can't be restored
 *     without a backfill). The cron rewrite reverts via `git revert`.
 */
export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key')
  if (!process.env.ADMIN_API_KEY || apiKey !== process.env.ADMIN_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: { step: string; status: string }[] = []

  try {
    // ── Step 1: make SET-NULL target user_id columns nullable ─────
    // (analytics_events.user_id, support_analytics.user_id, products.*,
    //  payout_requests.processed_by, trust_flags.resolved_by,
    //  competitor_profiles.competitor_brand_id, influencer_content_posts.*
    //  are already nullable — not listed here.)
    await pgClient.unsafe(`
      ALTER TABLE point_transactions  ALTER COLUMN user_id DROP NOT NULL;
      ALTER TABLE payout_requests     ALTER COLUMN user_id DROP NOT NULL;
      ALTER TABLE reward_redemptions  ALTER COLUMN user_id DROP NOT NULL;
      ALTER TABLE user_events         ALTER COLUMN user_id DROP NOT NULL;
      ALTER TABLE email_send_events   ALTER COLUMN user_id DROP NOT NULL;
    `)
    results.push({ step: 'drop_not_null (5 columns)', status: 'ensured' })

    // ── Step 1b: fix type mismatch — brand_alerts.rule_id was declared TEXT
    // but brand_alert_rules.id is UUID, so the fk_brand_alerts_rule FK can't be
    // created until the column type matches. Idempotent: only runs while it's
    // still text. (USING ::uuid fails if a value isn't a valid uuid — clean any
    // such orphan first; pre-launch the table is empty.)
    await pgClient.unsafe(`
      DO $$ BEGIN
        IF (SELECT data_type FROM information_schema.columns
            WHERE table_name = 'brand_alerts' AND column_name = 'rule_id') = 'text' THEN
          ALTER TABLE brand_alerts ALTER COLUMN rule_id TYPE uuid USING rule_id::uuid;
        END IF;
      END $$
    `)
    results.push({ step: 'fix brand_alerts.rule_id type (text→uuid)', status: 'ensured' })

    // ── Step 2: add all FKs (idempotent loop over the authoritative map) ──
    // Columns: conname | child_table | child_col | parent_table | parent_col | on_delete
    await pgClient.unsafe(`
      DO $$
      DECLARE r record;
      BEGIN
        FOR r IN SELECT * FROM (VALUES
          -- ── SET NULL: money/ledger history (retain anonymised) ──
          ('fk_point_transactions_user','point_transactions','user_id','users','id','SET NULL'),
          ('fk_payout_requests_user','payout_requests','user_id','users','id','SET NULL'),
          ('fk_reward_redemptions_user','reward_redemptions','user_id','users','id','SET NULL'),
          -- ── SET NULL: analytics (retain anonymised) ──
          ('fk_user_events_user','user_events','user_id','users','id','SET NULL'),
          ('fk_email_send_events_user','email_send_events','user_id','users','id','SET NULL'),
          ('fk_analytics_events_user','analytics_events','user_id','users','id','SET NULL'),
          ('fk_support_analytics_user','support_analytics','user_id','users','id','SET NULL'),
          -- ── SET NULL: admin-actor refs (record survives, actor link drops) ──
          ('fk_payout_requests_processed_by','payout_requests','processed_by','users','id','SET NULL'),
          ('fk_trust_flags_resolved_by','trust_flags','resolved_by','users','id','SET NULL'),
          ('fk_icp_reviewed_by','influencer_content_posts','reviewed_by','users','id','SET NULL'),
          ('fk_icp_previous_post','influencer_content_posts','previous_post_id','influencer_content_posts','id','SET NULL'),
          ('fk_products_owner','products','owner_id','users','id','SET NULL'),
          ('fk_products_claimed_by','products','claimed_by','users','id','SET NULL'),
          ('fk_products_created_by','products','created_by','users','id','SET NULL'),
          ('fk_products_merged_into','products','merged_into_id','products','id','SET NULL'),
          ('fk_competitor_profiles_competitor_brand','competitor_profiles','competitor_brand_id','users','id','SET NULL'),
          ('fk_import_jobs_default_product','import_jobs','default_product_id','products','id','SET NULL'),

          -- ── RESTRICT: catalog reward with redemption history ──
          ('fk_reward_redemptions_reward','reward_redemptions','reward_id','rewards','id','RESTRICT'),

          -- ── CASCADE: user-owned (→ users.id) ──
          ('fk_password_reset_tokens_user','password_reset_tokens','user_id','users','id','CASCADE'),
          ('fk_notification_queue_user','notification_queue','user_id','users','id','CASCADE'),
          ('fk_product_watchlist_user','product_watchlist','user_id','users','id','CASCADE'),
          ('fk_user_challenge_progress_user','user_challenge_progress','user_id','users','id','CASCADE'),
          ('fk_user_points_user','user_points','user_id','users','id','CASCADE'),
          ('fk_user_reputation_user','user_reputation','user_id','users','id','CASCADE'),
          ('fk_send_time_cohorts_user','send_time_cohorts','user_id','users','id','CASCADE'),
          -- NOTE: feedback_media.owner_id is POLYMORPHIC (owner_type =
          -- 'feedback' | 'survey_response'; owner_id = the parent feedback/
          -- survey_responses row id, NOT a users.id). It was wrongly FK'd to
          -- users.id here originally, which violated on every media insert and
          -- broke all audio/video/image uploads. Polymorphic columns are SKIP
          -- per the on-delete policy. Dropped in prod + migration 032.
          ('fk_consumer_intents_user','consumer_intents','user_id','users','id','CASCADE'),
          ('fk_trust_flags_user','trust_flags','user_id','users','id','CASCADE'),
          ('fk_contribution_events_user','contribution_events','user_id','users','id','CASCADE'),
          ('fk_community_posts_author','community_posts','author_id','users','id','CASCADE'),
          ('fk_community_replies_author','community_replies','author_id','users','id','CASCADE'),
          ('fk_community_reactions_user','community_reactions','user_id','users','id','CASCADE'),
          ('fk_community_poll_votes_user','community_poll_votes','user_id','users','id','CASCADE'),
          ('fk_campaign_applications_influencer','campaign_applications','influencer_id','users','id','CASCADE'),
          ('fk_brand_quality_feedback_brand_user','brand_quality_feedback','brand_user_id','users','id','CASCADE'),

          -- ── CASCADE: brand-owned (→ users.id) ──
          ('fk_brand_alert_rules_brand','brand_alert_rules','brand_id','users','id','CASCADE'),
          ('fk_brand_alerts_brand','brand_alerts','brand_id','users','id','CASCADE'),
          ('fk_brand_alerts_consumer','brand_alerts','consumer_id','users','id','CASCADE'),
          ('fk_brand_reward_configs_brand','brand_reward_configs','brand_id','users','id','CASCADE'),
          ('fk_brand_subscriptions_brand','brand_subscriptions','brand_id','users','id','CASCADE'),
          ('fk_competitive_benchmarks_brand','competitive_benchmarks','brand_id','users','id','CASCADE'),
          ('fk_competitive_insights_brand','competitive_insights','brand_id','users','id','CASCADE'),
          ('fk_competitive_reports_brand','competitive_reports','brand_id','users','id','CASCADE'),
          ('fk_competitive_scores_brand','competitive_scores','brand_id','users','id','CASCADE'),
          ('fk_competitor_alerts_brand','competitor_alerts','brand_id','users','id','CASCADE'),
          ('fk_competitor_digest_preferences_brand','competitor_digest_preferences','brand_id','users','id','CASCADE'),
          ('fk_competitor_profiles_brand','competitor_profiles','brand_id','users','id','CASCADE'),
          ('fk_import_jobs_brand','import_jobs','brand_id','users','id','CASCADE'),
          ('fk_content_review_reminders_brand','content_review_reminders','brand_id','users','id','CASCADE'),

          -- ── CASCADE: owned children (→ parent table) ──
          ('fk_campaign_applications_campaign','campaign_applications','campaign_id','influencer_campaigns','id','CASCADE'),
          ('fk_user_challenge_progress_challenge','user_challenge_progress','challenge_id','challenges','id','CASCADE'),
          ('fk_brand_alerts_rule','brand_alerts','rule_id','brand_alert_rules','id','CASCADE'),
          ('fk_brand_alerts_product','brand_alerts','product_id','products','id','CASCADE'),
          ('fk_brand_alert_rules_product','brand_alert_rules','product_id','products','id','CASCADE'),
          ('fk_brand_reward_configs_product','brand_reward_configs','product_id','products','id','CASCADE'),
          ('fk_brand_icps_product','brand_icps','product_id','products','id','CASCADE'),
          ('fk_competitor_alerts_profile','competitor_alerts','competitor_profile_id','competitor_profiles','id','CASCADE'),
          ('fk_competitor_products_profile','competitor_products','competitor_profile_id','competitor_profiles','id','CASCADE'),
          ('fk_competitor_price_history_product','competitor_price_history','competitor_product_id','competitor_products','id','CASCADE'),
          ('fk_competitor_products_product','competitor_products','product_id','products','id','CASCADE'),
          ('fk_content_review_reminders_campaign','content_review_reminders','campaign_id','influencer_campaigns','id','CASCADE'),
          ('fk_content_review_reminders_post','content_review_reminders','post_id','influencer_content_posts','id','CASCADE'),
          ('fk_consumer_intents_product','consumer_intents','product_id','products','id','CASCADE'),
          ('fk_deals_product','deals','product_id','products','id','CASCADE'),
          ('fk_extracted_themes_product','extracted_themes','product_id','products','id','CASCADE'),
          ('fk_ranking_history_product','ranking_history','product_id','products','id','CASCADE'),
          ('fk_survey_responses_survey','survey_responses','survey_id','surveys','id','CASCADE'),
          ('fk_community_reactions_post','community_reactions','post_id','community_posts','id','CASCADE'),
          ('fk_community_reactions_reply','community_reactions','reply_id','community_replies','id','CASCADE'),
          ('fk_community_replies_post','community_replies','post_id','community_posts','id','CASCADE'),
          ('fk_community_replies_parent','community_replies','parent_reply_id','community_replies','id','CASCADE'),
          ('fk_community_poll_votes_post','community_poll_votes','post_id','community_posts','id','CASCADE'),
          ('fk_trust_flags_contribution_event','trust_flags','contribution_event_id','contribution_events','id','CASCADE'),
          ('fk_brand_quality_feedback_contribution_event','brand_quality_feedback','contribution_event_id','contribution_events','id','CASCADE'),

          -- ── RESTRICT: product_id on consumer-content tables.
          --    Protects consumer data: a product hard-delete is BLOCKED while
          --    feedback/surveys/posts still reference it, rather than silently
          --    cascading it away. Safe — the merge flow soft-deletes (sets
          --    lifecycle_status='merged', row survives) and reassigns content
          --    first, so RESTRICT never trips on a merge; deleteProduct() (the
          --    only hard delete) is currently dead code.
          ('fk_feedback_product','feedback','product_id','products','id','RESTRICT'),
          ('fk_surveys_product','surveys','product_id','products','id','RESTRICT'),
          ('fk_survey_responses_product','survey_responses','product_id','products','id','RESTRICT'),
          ('fk_community_posts_product','community_posts','product_id','products','id','RESTRICT'),
          ('fk_community_deals_posts_product','community_deals_posts','product_id','products','id','RESTRICT'),
          ('fk_social_posts_product','social_posts','product_id','products','id','RESTRICT')
        ) AS t(conname, child, col, parent, refcol, act)
        LOOP
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = r.conname) THEN
            EXECUTE format(
              'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES %I(%I) ON DELETE %s',
              r.child, r.conname, r.col, r.parent, r.refcol, r.act
            );
          END IF;
        END LOOP;
      END $$
    `)
    results.push({ step: 'add_foreign_keys', status: 'ensured' })

    // Count how many of our FKs are now present (sanity signal in the response)
    const check = await pgClient.unsafe(`
      SELECT count(*)::int AS n FROM pg_constraint
      WHERE contype = 'f' AND conname LIKE 'fk_%'
    `)
    results.push({ step: 'fk_count', status: String((check as any)[0]?.n ?? '?') })

    return NextResponse.json({
      success: true,
      message: 'Migration 031 completed: 5 DROP NOT NULL + FK integrity with GDPR on-delete actions (B33)',
      results,
    })
  } catch (error) {
    console.error('[Migration 031] Error:', error)
    return NextResponse.json(
      {
        error: 'Migration 031 failed',
        details: error instanceof Error ? error.message : String(error),
        completedSteps: results,
      },
      { status: 500 },
    )
  }
}
