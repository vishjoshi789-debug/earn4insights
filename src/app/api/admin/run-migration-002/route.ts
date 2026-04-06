import { NextRequest, NextResponse } from 'next/server'
import { pgClient } from '@/db'

/**
 * Run migration 002: Hyper-Personalization Engine
 * POST /api/admin/run-migration-002
 * Header: x-api-key: <ADMIN_API_KEY>
 *
 * Creates 6 new tables and alters 3 existing tables.
 * Idempotent: all statements use IF NOT EXISTS.
 */
export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key')
  if (!process.env.ADMIN_API_KEY || apiKey !== process.env.ADMIN_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const migrationSQL = `
-- ── 1. consumer_signal_snapshots ─────────────────────────────────

CREATE TABLE IF NOT EXISTS consumer_signal_snapshots (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         TEXT        NOT NULL,
  signal_category TEXT        NOT NULL,
  signals         JSONB       NOT NULL,
  triggered_by    TEXT        NOT NULL,
  schema_version  TEXT        NOT NULL DEFAULT '1.0',
  snapshot_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_css_user_category_time
  ON consumer_signal_snapshots (user_id, signal_category, snapshot_at DESC);

CREATE INDEX IF NOT EXISTS idx_css_user_time
  ON consumer_signal_snapshots (user_id, snapshot_at DESC);

CREATE INDEX IF NOT EXISTS idx_css_snapshot_at
  ON consumer_signal_snapshots (snapshot_at);

-- ── 2. consent_records ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS consent_records (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          TEXT        NOT NULL,
  data_category    TEXT        NOT NULL,
  purpose          TEXT        NOT NULL,
  legal_basis      TEXT        NOT NULL DEFAULT 'explicit_consent',
  granted          BOOLEAN     NOT NULL DEFAULT FALSE,
  granted_at       TIMESTAMPTZ,
  revoked_at       TIMESTAMPTZ,
  consent_version  TEXT        NOT NULL,
  ip_address       TEXT,
  user_agent       TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_consent_user_category UNIQUE (user_id, data_category)
);

CREATE INDEX IF NOT EXISTS idx_cr_user_id
  ON consent_records (user_id);

CREATE INDEX IF NOT EXISTS idx_cr_user_granted
  ON consent_records (user_id, granted);

CREATE INDEX IF NOT EXISTS idx_cr_category_granted
  ON consent_records (data_category, granted);

-- ── 3. consumer_sensitive_attributes ─────────────────────────────

CREATE TABLE IF NOT EXISTS consumer_sensitive_attributes (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             TEXT        NOT NULL,
  attribute_category  TEXT        NOT NULL,
  encrypted_value     TEXT        NOT NULL,
  encryption_key_id   TEXT        NOT NULL,
  consent_record_id   UUID        NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ,

  CONSTRAINT uq_sensitive_user_category
    UNIQUE (user_id, attribute_category)
    DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX IF NOT EXISTS idx_csa_user_id
  ON consumer_sensitive_attributes (user_id);

CREATE INDEX IF NOT EXISTS idx_csa_consent_record
  ON consumer_sensitive_attributes (consent_record_id);

CREATE INDEX IF NOT EXISTS idx_csa_deleted_at
  ON consumer_sensitive_attributes (deleted_at)
  WHERE deleted_at IS NOT NULL;

-- ── 4. brand_icps ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS brand_icps (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id         TEXT        NOT NULL,
  product_id       TEXT,
  name             TEXT        NOT NULL,
  description      TEXT,
  attributes       JSONB       NOT NULL,
  match_threshold  INTEGER     NOT NULL DEFAULT 60,
  is_active        BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bi_brand_active
  ON brand_icps (brand_id, is_active);

CREATE INDEX IF NOT EXISTS idx_bi_brand_product
  ON brand_icps (brand_id, product_id);

-- ── 5. icp_match_scores ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS icp_match_scores (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  icp_id       UUID        NOT NULL,
  consumer_id  TEXT        NOT NULL,
  match_score  INTEGER     NOT NULL,
  breakdown    JSONB       NOT NULL,
  computed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_stale     BOOLEAN     NOT NULL DEFAULT FALSE,

  CONSTRAINT uq_icp_match_icp_consumer UNIQUE (icp_id, consumer_id)
);

CREATE INDEX IF NOT EXISTS idx_ims_icp_score
  ON icp_match_scores (icp_id, match_score DESC)
  WHERE is_stale = FALSE;

CREATE INDEX IF NOT EXISTS idx_ims_icp_threshold
  ON icp_match_scores (icp_id, match_score DESC)
  WHERE match_score >= 60 AND is_stale = FALSE;

CREATE INDEX IF NOT EXISTS idx_ims_consumer_stale
  ON icp_match_scores (consumer_id, is_stale)
  WHERE is_stale = TRUE;

CREATE INDEX IF NOT EXISTS idx_ims_stale_computed
  ON icp_match_scores (is_stale, computed_at)
  WHERE is_stale = TRUE;

-- ── 6. consumer_social_connections ───────────────────────────────

CREATE TABLE IF NOT EXISTS consumer_social_connections (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                TEXT        NOT NULL,
  platform               TEXT        NOT NULL,
  encrypted_access_token TEXT,
  encryption_key_id      TEXT,
  inferred_interests     JSONB,
  inference_method       TEXT,
  consent_record_id      UUID        NOT NULL,
  connected_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_synced_at         TIMESTAMPTZ,
  revoked_at             TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_csc_user_platform_active
  ON consumer_social_connections (user_id, platform)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_csc_user_id
  ON consumer_social_connections (user_id);

CREATE INDEX IF NOT EXISTS idx_csc_last_synced
  ON consumer_social_connections (last_synced_at)
  WHERE revoked_at IS NULL;

-- ── ALTER existing tables ────────────────────────────────────────

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS psychographic         JSONB,
  ADD COLUMN IF NOT EXISTS social_signals        JSONB,
  ADD COLUMN IF NOT EXISTS signal_version        TEXT DEFAULT '1.0',
  ADD COLUMN IF NOT EXISTS last_signal_computed_at TIMESTAMPTZ;

ALTER TABLE brand_alert_rules
  ADD COLUMN IF NOT EXISTS icp_id          UUID,
  ADD COLUMN IF NOT EXISTS min_match_score INTEGER DEFAULT 60;

CREATE INDEX IF NOT EXISTS idx_bar_icp_id
  ON brand_alert_rules (icp_id)
  WHERE icp_id IS NOT NULL;

ALTER TABLE brand_alerts
  ADD COLUMN IF NOT EXISTS match_score_snapshot JSONB;
`

    await pgClient.unsafe(migrationSQL)

    return NextResponse.json({
      success: true,
      message: 'Migration 002 applied successfully.',
      nextStep: 'POST /api/admin/migrate-consent-records to backfill consent_records',
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    const detail = {
      message: error?.message,
      code: error?.code,
      name: error?.name,
      hint: error?.hint,
      detail: error?.detail,
      severity: error?.severity,
      str: String(error),
    }
    return NextResponse.json(
      { success: false, error: detail },
      { status: 500 }
    )
  }
}
