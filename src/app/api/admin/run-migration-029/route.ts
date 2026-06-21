import { NextRequest, NextResponse } from 'next/server'
import { pgClient } from '@/db'

/**
 * Run migration 029: Money/data-integrity CHECK constraints (Tier B — B34 + B18).
 * POST /api/admin/run-migration-029
 * Header: x-api-key: <ADMIN_API_KEY>
 *
 * Phase 1 of the Money + Data Integrity batch — purely additive CHECK
 * constraints on columns the prod audit confirmed have ZERO violations.
 * No data is touched; no FKs (B33) here.
 *
 * Adds:
 *   - chk_campaign_payments_amounts_nonneg    amount/platform_fee/influencer_amount >= 0 (paise)
 *   - chk_reward_redemptions_points_nonneg     points_spent >= 0
 *   - chk_rewards_points_cost_nonneg           points_cost  >= 0
 *   - chk_campaign_applications_proposed_rate_range  (B18) 0 <= proposed_rate <= cap
 *   - chk_campaign_applications_status         status enum (pending/reviewing/accepted/rejected/withdrawn)
 *
 * DEFERRED (pending status GROUP-BY audit): CHECKs on campaign_payments.status,
 * reward_redemptions.status, campaign_payments.payment_type.
 *
 * Idempotent: every constraint is added inside a DO-block guarded on
 * pg_constraint.conname, so the route is safe to re-run. No BEGIN/COMMIT
 * (pooled pgClient blocks transaction control).
 *
 * Pattern parallel: migration 028 (ivr_status_check) for the
 * DO-block / pg_constraint idempotency shape.
 */
export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key')
  if (!process.env.ADMIN_API_KEY || apiKey !== process.env.ADMIN_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: { name: string; status: string }[] = []

  try {
    // ── Money >= 0: campaign_payments (paise) ─────────────────────
    await pgClient.unsafe(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'chk_campaign_payments_amounts_nonneg'
        ) THEN
          ALTER TABLE campaign_payments
            ADD CONSTRAINT chk_campaign_payments_amounts_nonneg
            CHECK (
              amount >= 0
              AND platform_fee >= 0
              AND (influencer_amount IS NULL OR influencer_amount >= 0)
            );
        END IF;
      END $$
    `)
    results.push({ name: 'chk_campaign_payments_amounts_nonneg', status: 'ensured' })

    // ── Money >= 0: reward_redemptions.points_spent ───────────────
    await pgClient.unsafe(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'chk_reward_redemptions_points_nonneg'
        ) THEN
          ALTER TABLE reward_redemptions
            ADD CONSTRAINT chk_reward_redemptions_points_nonneg
            CHECK (points_spent >= 0);
        END IF;
      END $$
    `)
    results.push({ name: 'chk_reward_redemptions_points_nonneg', status: 'ensured' })

    // ── Money >= 0: rewards.points_cost ───────────────────────────
    await pgClient.unsafe(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'chk_rewards_points_cost_nonneg'
        ) THEN
          ALTER TABLE rewards
            ADD CONSTRAINT chk_rewards_points_cost_nonneg
            CHECK (points_cost >= 0);
        END IF;
      END $$
    `)
    results.push({ name: 'chk_rewards_points_cost_nonneg', status: 'ensured' })

    // ── B18: proposed_rate range (0 .. cap) ───────────────────────
    // Cap = 100,000,000 paise = ₹10,00,000 (₹10 lakh). Overflow/abuse
    // guard, NOT a price ceiling — raise the literal (e.g. 500000000 for
    // ₹50 lakh) here AND in the service-side validation if business grows.
    await pgClient.unsafe(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'chk_campaign_applications_proposed_rate_range'
        ) THEN
          ALTER TABLE campaign_applications
            ADD CONSTRAINT chk_campaign_applications_proposed_rate_range
            CHECK (proposed_rate >= 0 AND proposed_rate <= 100000000);
        END IF;
      END $$
    `)
    results.push({ name: 'chk_campaign_applications_proposed_rate_range', status: 'ensured' })

    // ── B34: campaign_applications.status enum ────────────────────
    await pgClient.unsafe(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'chk_campaign_applications_status'
        ) THEN
          ALTER TABLE campaign_applications
            ADD CONSTRAINT chk_campaign_applications_status
            CHECK (status IN ('pending', 'reviewing', 'accepted', 'rejected', 'withdrawn'));
        END IF;
      END $$
    `)
    results.push({ name: 'chk_campaign_applications_status', status: 'ensured' })

    return NextResponse.json({
      success: true,
      message: 'Migration 029 completed: 5 additive CHECK constraints (B34 + B18)',
      results,
    })
  } catch (error) {
    console.error('[Migration 029] Error:', error)
    return NextResponse.json(
      {
        error: 'Migration 029 failed',
        details: error instanceof Error ? error.message : String(error),
        completedSteps: results,
      },
      { status: 500 },
    )
  }
}
