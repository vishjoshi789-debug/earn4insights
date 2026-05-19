import { NextRequest, NextResponse } from 'next/server'
import { pgClient } from '@/db'

/**
 * Run migration 017: Platform Analytics (Founder Dashboard)
 * POST /api/admin/run-migration-017
 * Header: x-api-key: <ADMIN_API_KEY>
 *
 * Creates:
 *   1. platform_metrics_daily       — daily user + engagement snapshot
 *   2. revenue_metrics_daily        — daily payment / revenue rollup
 *   3. retention_cohorts            — sliding-window cohort retention
 *   4. platform_costs               — manual cost ledger (founder enters)
 *   5. financial_snapshots_monthly  — derived monthly aggregate (incl cash_balance + runway)
 *
 * Idempotent: CREATE TABLE / INDEX / CONSTRAINT all guarded by IF NOT EXISTS
 * or DO blocks. Re-runnable on any environment.
 *
 * FK CASCADE policy:
 *   - platform_costs.entered_by → users.id SET NULL  (preserve cost history if
 *     the founder who entered it is later deleted)
 *
 * No FKs from the daily / monthly tables — they're append-only rollups
 * with no row-level user dependency.
 */
export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key')
  if (!process.env.ADMIN_API_KEY || apiKey !== process.env.ADMIN_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: { name: string; status: string }[] = []

  try {
    // ── 1. platform_metrics_daily ────────────────────────────────
    await pgClient.unsafe(`
      CREATE TABLE IF NOT EXISTS platform_metrics_daily (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        date DATE NOT NULL UNIQUE,
        total_users INTEGER NOT NULL DEFAULT 0,
        total_brands INTEGER NOT NULL DEFAULT 0,
        total_consumers INTEGER NOT NULL DEFAULT 0,
        total_influencers INTEGER NOT NULL DEFAULT 0,
        new_users INTEGER NOT NULL DEFAULT 0,
        new_brands INTEGER NOT NULL DEFAULT 0,
        new_consumers INTEGER NOT NULL DEFAULT 0,
        new_influencers INTEGER NOT NULL DEFAULT 0,
        dau INTEGER NOT NULL DEFAULT 0,
        wau INTEGER NOT NULL DEFAULT 0,
        mau INTEGER NOT NULL DEFAULT 0,
        brand_dau INTEGER NOT NULL DEFAULT 0,
        consumer_dau INTEGER NOT NULL DEFAULT 0,
        influencer_dau INTEGER NOT NULL DEFAULT 0,
        feedback_count INTEGER NOT NULL DEFAULT 0,
        survey_responses INTEGER NOT NULL DEFAULT 0,
        deals_redeemed INTEGER NOT NULL DEFAULT 0,
        community_posts INTEGER NOT NULL DEFAULT 0,
        community_comments INTEGER NOT NULL DEFAULT 0,
        campaigns_created INTEGER NOT NULL DEFAULT 0,
        campaigns_completed INTEGER NOT NULL DEFAULT 0,
        chat_conversations INTEGER NOT NULL DEFAULT 0,
        chat_resolved_by_ai INTEGER NOT NULL DEFAULT 0,
        support_tickets INTEGER NOT NULL DEFAULT 0,
        computed_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `)
    results.push({ name: 'platform_metrics_daily', status: 'created' })

    await pgClient.unsafe(`
      CREATE INDEX IF NOT EXISTS idx_platform_metrics_date_desc
        ON platform_metrics_daily(date DESC)
    `)
    results.push({ name: 'idx_platform_metrics_date_desc', status: 'created' })

    // ── 2. revenue_metrics_daily ─────────────────────────────────
    await pgClient.unsafe(`
      CREATE TABLE IF NOT EXISTS revenue_metrics_daily (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        date DATE NOT NULL UNIQUE,
        gross_revenue INTEGER NOT NULL DEFAULT 0,
        platform_fees INTEGER NOT NULL DEFAULT 0,
        influencer_payouts INTEGER NOT NULL DEFAULT 0,
        consumer_rewards_redeemed INTEGER NOT NULL DEFAULT 0,
        refunds INTEGER NOT NULL DEFAULT 0,
        net_revenue INTEGER NOT NULL DEFAULT 0,
        payment_count INTEGER NOT NULL DEFAULT 0,
        payment_success_count INTEGER NOT NULL DEFAULT 0,
        payment_failed_count INTEGER NOT NULL DEFAULT 0,
        avg_payment_amount INTEGER NOT NULL DEFAULT 0,
        currency TEXT NOT NULL DEFAULT 'INR',
        computed_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `)
    results.push({ name: 'revenue_metrics_daily', status: 'created' })

    await pgClient.unsafe(`
      CREATE INDEX IF NOT EXISTS idx_revenue_metrics_date_desc
        ON revenue_metrics_daily(date DESC)
    `)
    results.push({ name: 'idx_revenue_metrics_date_desc', status: 'created' })

    // ── 3. retention_cohorts ─────────────────────────────────────
    await pgClient.unsafe(`
      CREATE TABLE IF NOT EXISTS retention_cohorts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        cohort_date DATE NOT NULL,
        cohort_size INTEGER NOT NULL,
        role TEXT NOT NULL,
        period_type TEXT NOT NULL,
        day_1 NUMERIC(5,2),
        day_7 NUMERIC(5,2),
        day_14 NUMERIC(5,2),
        day_30 NUMERIC(5,2),
        day_60 NUMERIC(5,2),
        day_90 NUMERIC(5,2),
        computed_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `)
    results.push({ name: 'retention_cohorts', status: 'created' })

    await pgClient.unsafe(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uniq_retention_cohort') THEN
          ALTER TABLE retention_cohorts
            ADD CONSTRAINT uniq_retention_cohort
            UNIQUE (cohort_date, role, period_type);
        END IF;
      END $$
    `)
    results.push({ name: 'uniq_retention_cohort', status: 'created' })

    await pgClient.unsafe(`
      CREATE INDEX IF NOT EXISTS idx_retention_role_period
        ON retention_cohorts(role, period_type, cohort_date DESC)
    `)
    results.push({ name: 'idx_retention_role_period', status: 'created' })

    // ── 4. platform_costs ────────────────────────────────────────
    await pgClient.unsafe(`
      CREATE TABLE IF NOT EXISTS platform_costs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        month DATE NOT NULL,
        category TEXT NOT NULL,
        description TEXT,
        amount INTEGER NOT NULL,
        currency TEXT NOT NULL DEFAULT 'INR',
        is_recurring BOOLEAN NOT NULL DEFAULT true,
        entered_by TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `)
    results.push({ name: 'platform_costs', status: 'created' })

    await pgClient.unsafe(`
      CREATE INDEX IF NOT EXISTS idx_platform_costs_month
        ON platform_costs(month DESC, category)
    `)
    results.push({ name: 'idx_platform_costs_month', status: 'created' })

    await pgClient.unsafe(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_platform_costs_entered_by') THEN
          ALTER TABLE platform_costs
            ADD CONSTRAINT fk_platform_costs_entered_by
            FOREIGN KEY (entered_by) REFERENCES users(id) ON DELETE SET NULL;
        END IF;
      END $$
    `)
    results.push({ name: 'fk_platform_costs_entered_by', status: 'created' })

    // ── 5. financial_snapshots_monthly ───────────────────────────
    await pgClient.unsafe(`
      CREATE TABLE IF NOT EXISTS financial_snapshots_monthly (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        month DATE NOT NULL UNIQUE,
        gross_revenue INTEGER NOT NULL DEFAULT 0,
        platform_fees INTEGER NOT NULL DEFAULT 0,
        influencer_payouts INTEGER NOT NULL DEFAULT 0,
        consumer_rewards INTEGER NOT NULL DEFAULT 0,
        refunds INTEGER NOT NULL DEFAULT 0,
        net_revenue INTEGER NOT NULL DEFAULT 0,
        total_costs INTEGER NOT NULL DEFAULT 0,
        cost_breakdown JSONB DEFAULT '{}'::jsonb,
        gross_margin INTEGER NOT NULL DEFAULT 0,
        gross_margin_percent NUMERIC(5,2) DEFAULT 0,
        cash_balance INTEGER NOT NULL DEFAULT 0,
        burn_rate INTEGER NOT NULL DEFAULT 0,
        runway_months NUMERIC(5,1),
        mrr INTEGER NOT NULL DEFAULT 0,
        mrr_growth_percent NUMERIC(5,2) DEFAULT 0,
        arpu INTEGER NOT NULL DEFAULT 0,
        brand_ltv INTEGER NOT NULL DEFAULT 0,
        consumer_ltv INTEGER NOT NULL DEFAULT 0,
        computed_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `)
    results.push({ name: 'financial_snapshots_monthly', status: 'created' })

    await pgClient.unsafe(`
      CREATE INDEX IF NOT EXISTS idx_financial_snapshots_month_desc
        ON financial_snapshots_monthly(month DESC)
    `)
    results.push({ name: 'idx_financial_snapshots_month_desc', status: 'created' })

    return NextResponse.json({
      success: true,
      message: 'Migration 017 completed: Platform Analytics (5 tables)',
      results,
    })
  } catch (error) {
    console.error('[Migration 017] Error:', error)
    return NextResponse.json(
      {
        error: 'Migration 017 failed',
        details: error instanceof Error ? error.message : String(error),
        completedSteps: results,
      },
      { status: 500 },
    )
  }
}
