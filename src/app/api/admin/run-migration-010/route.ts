import { NextRequest, NextResponse } from 'next/server'
import { pgClient } from '@/db'

/**
 * Run migration 010: Competitive Intelligence Dashboard
 * POST /api/admin/run-migration-010
 * Header: x-api-key: <ADMIN_API_KEY>
 *
 * Creates 9 new tables:
 *   - competitor_profiles         (brand → competitor tracking, on- and off-platform)
 *   - competitor_products         (competitor products + features + pricing)
 *   - competitor_price_history    (append-only price log)
 *   - competitive_insights        (AI/system generated insights per brand)
 *   - competitive_benchmarks      (per-metric brand vs category stats)
 *   - competitive_scores          (0-100 composite score per brand/category)
 *   - competitor_alerts           (real-time competitor events)
 *   - competitive_reports         (daily/weekly/monthly digest output)
 *   - competitor_digest_preferences (per-brand digest settings)
 *
 * Prerequisites: migrations 001-009 must be applied first.
 * Idempotent: all statements use IF NOT EXISTS.
 */
export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key')
  if (!process.env.ADMIN_API_KEY || apiKey !== process.env.ADMIN_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: { name: string; status: string }[] = []

  try {
    // ── 1. CREATE competitor_profiles ─────────────────────────────────
    await pgClient.unsafe(`
      CREATE TABLE IF NOT EXISTS competitor_profiles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        brand_id TEXT NOT NULL,
        competitor_type TEXT NOT NULL,
        competitor_brand_id TEXT,
        competitor_name TEXT NOT NULL,
        competitor_website TEXT,
        competitor_logo_url TEXT,
        category TEXT NOT NULL,
        sub_categories TEXT[] DEFAULT '{}',
        geographies TEXT[] DEFAULT '{}',
        is_system_suggested BOOLEAN NOT NULL DEFAULT false,
        is_confirmed BOOLEAN NOT NULL DEFAULT false,
        is_active BOOLEAN NOT NULL DEFAULT true,
        confirmed_at TIMESTAMP,
        dismissed_at TIMESTAMP,
        notes TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `)
    // Partial UNIQUE: one row per (brand, on-platform competitor)
    await pgClient.unsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_cp_brand_onplatform_unique
        ON competitor_profiles(brand_id, competitor_brand_id)
        WHERE competitor_brand_id IS NOT NULL
    `)
    // Partial UNIQUE: one row per (brand, off-platform competitor name)
    await pgClient.unsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_cp_brand_offplatform_unique
        ON competitor_profiles(brand_id, competitor_name)
        WHERE competitor_type = 'off_platform'
    `)
    await pgClient.unsafe(`CREATE INDEX IF NOT EXISTS idx_cp_brand_active_confirmed ON competitor_profiles(brand_id, is_active, is_confirmed)`)
    await pgClient.unsafe(`CREATE INDEX IF NOT EXISTS idx_cp_competitor_brand ON competitor_profiles(competitor_brand_id)`)
    await pgClient.unsafe(`CREATE INDEX IF NOT EXISTS idx_cp_category ON competitor_profiles(category)`)
    results.push({ name: 'competitor_profiles', status: 'created' })

    // ── 2. CREATE competitor_products ─────────────────────────────────
    await pgClient.unsafe(`
      CREATE TABLE IF NOT EXISTS competitor_products (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        competitor_profile_id UUID NOT NULL,
        product_name TEXT NOT NULL,
        product_id TEXT,
        category TEXT NOT NULL,
        description TEXT,
        current_price INTEGER,
        currency TEXT DEFAULT 'INR',
        price_updated_at TIMESTAMP,
        features JSONB DEFAULT '[]',
        positioning TEXT,
        target_segment TEXT,
        external_url TEXT,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `)
    await pgClient.unsafe(`CREATE INDEX IF NOT EXISTS idx_cprod_profile ON competitor_products(competitor_profile_id)`)
    await pgClient.unsafe(`CREATE INDEX IF NOT EXISTS idx_cprod_category ON competitor_products(category)`)
    await pgClient.unsafe(`CREATE INDEX IF NOT EXISTS idx_cprod_product_id ON competitor_products(product_id)`)
    results.push({ name: 'competitor_products', status: 'created' })

    // ── 3. CREATE competitor_price_history ───────────────────────────
    await pgClient.unsafe(`
      CREATE TABLE IF NOT EXISTS competitor_price_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        competitor_product_id UUID NOT NULL,
        price INTEGER NOT NULL,
        currency TEXT NOT NULL DEFAULT 'INR',
        source TEXT NOT NULL,
        recorded_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `)
    await pgClient.unsafe(`CREATE INDEX IF NOT EXISTS idx_cphist_product_time ON competitor_price_history(competitor_product_id, recorded_at DESC)`)
    results.push({ name: 'competitor_price_history', status: 'created' })

    // ── 4. CREATE competitive_insights ────────────────────────────────
    await pgClient.unsafe(`
      CREATE TABLE IF NOT EXISTS competitive_insights (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        brand_id TEXT NOT NULL,
        insight_type TEXT NOT NULL,
        title TEXT NOT NULL,
        summary TEXT NOT NULL,
        details JSONB NOT NULL,
        data_sources JSONB NOT NULL,
        severity TEXT NOT NULL DEFAULT 'info',
        is_read BOOLEAN NOT NULL DEFAULT false,
        is_actionable BOOLEAN NOT NULL DEFAULT false,
        action_suggestion TEXT,
        expires_at TIMESTAMP,
        generated_by TEXT NOT NULL DEFAULT 'system',
        ai_model TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `)
    await pgClient.unsafe(`CREATE INDEX IF NOT EXISTS idx_cinsights_brand_unread ON competitive_insights(brand_id, is_read, created_at DESC)`)
    await pgClient.unsafe(`CREATE INDEX IF NOT EXISTS idx_cinsights_brand_type ON competitive_insights(brand_id, insight_type)`)
    await pgClient.unsafe(`CREATE INDEX IF NOT EXISTS idx_cinsights_expires ON competitive_insights(expires_at) WHERE expires_at IS NOT NULL`)
    results.push({ name: 'competitive_insights', status: 'created' })

    // ── 5. CREATE competitive_benchmarks ──────────────────────────────
    await pgClient.unsafe(`
      CREATE TABLE IF NOT EXISTS competitive_benchmarks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        brand_id TEXT NOT NULL,
        category TEXT NOT NULL,
        metric_name TEXT NOT NULL,
        brand_value NUMERIC(10,4) NOT NULL,
        category_avg NUMERIC(10,4) NOT NULL,
        category_best NUMERIC(10,4),
        category_worst NUMERIC(10,4),
        percentile INTEGER,
        competitor_values JSONB DEFAULT '{}',
        sample_size INTEGER NOT NULL DEFAULT 0,
        period_start DATE NOT NULL,
        period_end DATE NOT NULL,
        computed_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `)
    await pgClient.unsafe(`CREATE INDEX IF NOT EXISTS idx_cbench_brand_cat_metric ON competitive_benchmarks(brand_id, category, metric_name)`)
    await pgClient.unsafe(`CREATE INDEX IF NOT EXISTS idx_cbench_brand_computed ON competitive_benchmarks(brand_id, computed_at DESC)`)
    results.push({ name: 'competitive_benchmarks', status: 'created' })

    // ── 6. CREATE competitive_scores ──────────────────────────────────
    await pgClient.unsafe(`
      CREATE TABLE IF NOT EXISTS competitive_scores (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        brand_id TEXT NOT NULL,
        category TEXT NOT NULL,
        overall_score INTEGER NOT NULL,
        score_breakdown JSONB NOT NULL,
        rank INTEGER NOT NULL,
        total_in_category INTEGER NOT NULL,
        trend TEXT NOT NULL DEFAULT 'stable',
        previous_score INTEGER,
        computed_at TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE(brand_id, category)
      )
    `)
    await pgClient.unsafe(`CREATE INDEX IF NOT EXISTS idx_cscore_category_score ON competitive_scores(category, overall_score DESC)`)
    results.push({ name: 'competitive_scores', status: 'created' })

    // ── 7. CREATE competitor_alerts ───────────────────────────────────
    await pgClient.unsafe(`
      CREATE TABLE IF NOT EXISTS competitor_alerts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        brand_id TEXT NOT NULL,
        competitor_profile_id UUID,
        alert_type TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        severity TEXT NOT NULL DEFAULT 'info',
        data JSONB NOT NULL,
        is_read BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `)
    await pgClient.unsafe(`CREATE INDEX IF NOT EXISTS idx_calert_brand_unread ON competitor_alerts(brand_id, is_read, created_at DESC)`)
    await pgClient.unsafe(`CREATE INDEX IF NOT EXISTS idx_calert_brand_type ON competitor_alerts(brand_id, alert_type)`)
    await pgClient.unsafe(`CREATE INDEX IF NOT EXISTS idx_calert_profile ON competitor_alerts(competitor_profile_id)`)
    results.push({ name: 'competitor_alerts', status: 'created' })

    // ── 8. CREATE competitive_reports ─────────────────────────────────
    await pgClient.unsafe(`
      CREATE TABLE IF NOT EXISTS competitive_reports (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        brand_id TEXT NOT NULL,
        report_type TEXT NOT NULL,
        title TEXT NOT NULL,
        content JSONB NOT NULL,
        category TEXT,
        period_start DATE NOT NULL,
        period_end DATE NOT NULL,
        email_sent BOOLEAN NOT NULL DEFAULT false,
        email_sent_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `)
    await pgClient.unsafe(`CREATE INDEX IF NOT EXISTS idx_creport_brand_type_created ON competitive_reports(brand_id, report_type, created_at DESC)`)
    results.push({ name: 'competitive_reports', status: 'created' })

    // ── 9. CREATE competitor_digest_preferences ───────────────────────
    await pgClient.unsafe(`
      CREATE TABLE IF NOT EXISTS competitor_digest_preferences (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        brand_id TEXT NOT NULL UNIQUE,
        digest_frequency TEXT NOT NULL DEFAULT 'weekly',
        email_enabled BOOLEAN NOT NULL DEFAULT true,
        in_app_enabled BOOLEAN NOT NULL DEFAULT true,
        categories TEXT[] DEFAULT '{}',
        alert_types TEXT[] DEFAULT '{}',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `)
    results.push({ name: 'competitor_digest_preferences', status: 'created' })

    return NextResponse.json({
      success: true,
      message: 'Migration 010 completed: Competitive Intelligence Dashboard (9 tables)',
      results,
    })
  } catch (error) {
    console.error('[Migration 010] Error:', error)
    return NextResponse.json(
      {
        error: 'Migration 010 failed',
        details: error instanceof Error ? error.message : String(error),
        completedSteps: results,
      },
      { status: 500 }
    )
  }
}
