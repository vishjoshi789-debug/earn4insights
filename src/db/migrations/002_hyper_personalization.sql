-- ════════════════════════════════════════════════════════════════
-- Migration 002: Hyper-Personalization Engine (Phase 9)
-- ════════════════════════════════════════════════════════════════
-- Run order:
--   1. New tables
--   2. Indexes on new tables
--   3. ALTER existing tables (additive only — no column drops)
--   4. Indexes on altered columns
--
-- After running this SQL, run the application-level consent migration:
--   POST /api/admin/migrate-consent-records
--   (migrates userProfiles.consent JSONB → consent_records rows)
-- ════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. consumer_signal_snapshots ─────────────────────────────────
-- Append-only time-series of consumer signal state per category.
-- Retention policy: SIGNAL_RETENTION_DAYS env var (default 365 days).
-- Cleanup cron: DELETE WHERE snapshot_at < NOW() - INTERVAL '365 days'

CREATE TABLE IF NOT EXISTS consumer_signal_snapshots (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         TEXT        NOT NULL,
  signal_category TEXT        NOT NULL,
  -- 'behavioral' | 'demographic' | 'psychographic' | 'sensitive' | 'social'
  signals         JSONB       NOT NULL,
  triggered_by    TEXT        NOT NULL,
  -- 'cron_daily' | 'onboarding_complete' | 'feedback_submit' | 'social_sync' | 'manual'
  schema_version  TEXT        NOT NULL DEFAULT '1.0',
  snapshot_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_css_user_category_time
  ON consumer_signal_snapshots (user_id, signal_category, snapshot_at DESC);

CREATE INDEX IF NOT EXISTS idx_css_user_time
  ON consumer_signal_snapshots (user_id, snapshot_at DESC);

CREATE INDEX IF NOT EXISTS idx_css_snapshot_at
  ON consumer_signal_snapshots (snapshot_at);
-- Used by retention cleanup cron

-- ── 2. consent_records ───────────────────────────────────────────
-- One row per user per data category.
-- Replaces userProfiles.consent JSONB blob (deprecated after migration).
-- GDPR Art. 7 / India DPDP Act 2023 §6.

CREATE TABLE IF NOT EXISTS consent_records (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          TEXT        NOT NULL,
  data_category    TEXT        NOT NULL,
  -- Standard: 'behavioral' | 'demographic' | 'psychographic' | 'social'
  -- Sensitive: 'sensitive_health' | 'sensitive_dietary' | 'sensitive_religion' | 'sensitive_caste'
  -- Legacy:   'tracking' | 'personalization' | 'analytics' | 'marketing'
  purpose          TEXT        NOT NULL,
  legal_basis      TEXT        NOT NULL DEFAULT 'explicit_consent',
  -- 'explicit_consent' | 'legitimate_interest' | 'contract'
  -- sensitive_* categories MUST use 'explicit_consent'
  granted          BOOLEAN     NOT NULL DEFAULT FALSE,
  granted_at       TIMESTAMPTZ,
  revoked_at       TIMESTAMPTZ,
  consent_version  TEXT        NOT NULL,
  -- Policy version shown to user at grant time, e.g. 'privacy-policy-v2.1'
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
-- Used for admin reporting: "how many users consented to X?"

-- ── 3. consumer_sensitive_attributes ─────────────────────────────
-- GDPR Art. 9 / DPDP special-category data.
-- Encrypted at rest. Soft-deleted on erasure request.
-- Physical deletion runs 30 days after deleted_at is set.

CREATE TABLE IF NOT EXISTS consumer_sensitive_attributes (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             TEXT        NOT NULL,
  attribute_category  TEXT        NOT NULL,
  -- 'religion' | 'caste' | 'dietary' | 'health'
  encrypted_value     TEXT        NOT NULL,
  -- AES-256-GCM encrypted JSON blob (via encryptForStorage())
  encryption_key_id   TEXT        NOT NULL,
  -- e.g. 'v1', 'v2' — used to look up correct key for decryption
  consent_record_id   UUID        NOT NULL,
  -- → consent_records.id. Specific consent authorising this data.
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ,
  -- Soft delete. Physical DELETE scheduled 30 days after deleted_at.

  CONSTRAINT uq_sensitive_user_category
    UNIQUE (user_id, attribute_category)
    DEFERRABLE INITIALLY DEFERRED
  -- Deferred to allow soft-delete + re-insert in same transaction.
  -- Note: partial unique (WHERE deleted_at IS NULL) is not standard SQL;
  -- uniqueness is enforced at the application layer in the repository.
);

CREATE INDEX IF NOT EXISTS idx_csa_user_id
  ON consumer_sensitive_attributes (user_id);

CREATE INDEX IF NOT EXISTS idx_csa_consent_record
  ON consumer_sensitive_attributes (consent_record_id);

CREATE INDEX IF NOT EXISTS idx_csa_deleted_at
  ON consumer_sensitive_attributes (deleted_at)
  WHERE deleted_at IS NOT NULL;
-- Used by physical deletion cron

-- ── 4. brand_icps ────────────────────────────────────────────────
-- Brand Ideal Consumer Profile definitions.
-- One brand can have multiple ICPs (per product or brand-wide).

CREATE TABLE IF NOT EXISTS brand_icps (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id         TEXT        NOT NULL,
  -- → users.id (role='brand')
  product_id       TEXT,
  -- → products.id. NULL = brand-wide ICP.
  name             TEXT        NOT NULL,
  description      TEXT,
  attributes       JSONB       NOT NULL,
  -- { version, criteria: Record<key, { values, weight, required, requiresConsentCategory? }>,
  --   totalWeight: 100 }
  -- INVARIANT: sum(criteria[*].weight) = 100 (enforced in service layer)
  match_threshold  INTEGER     NOT NULL DEFAULT 60,
  -- 0-100. Alerts only fire when consumer match_score >= match_threshold.
  is_active        BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bi_brand_active
  ON brand_icps (brand_id, is_active);

CREATE INDEX IF NOT EXISTS idx_bi_brand_product
  ON brand_icps (brand_id, product_id);

-- ── 5. icp_match_scores ──────────────────────────────────────────
-- Persisted cache of consumer ↔ ICP match scores.
-- is_stale=true rows are refreshed by the daily recompute cron.
-- Scoring algorithm: normalised upward (unconsented criteria excluded
-- from total_possible — consumers not penalised for withheld data).

CREATE TABLE IF NOT EXISTS icp_match_scores (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  icp_id       UUID        NOT NULL,
  -- → brand_icps.id
  consumer_id  TEXT        NOT NULL,
  -- → users.id
  match_score  INTEGER     NOT NULL,
  -- 0-100, normalised against total_possible (not fixed 100)
  breakdown    JSONB       NOT NULL,
  -- { criteriaScores, totalEarned, totalPossible, consentGaps, explainability }
  computed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_stale     BOOLEAN     NOT NULL DEFAULT FALSE,

  CONSTRAINT uq_icp_match_icp_consumer UNIQUE (icp_id, consumer_id)
);

CREATE INDEX IF NOT EXISTS idx_ims_icp_score
  ON icp_match_scores (icp_id, match_score DESC)
  WHERE is_stale = FALSE;
-- "Top matching consumers for ICP" — hot query path

CREATE INDEX IF NOT EXISTS idx_ims_icp_threshold
  ON icp_match_scores (icp_id, match_score DESC)
  WHERE match_score >= 60 AND is_stale = FALSE;
-- Alert threshold queries (default threshold = 60)

CREATE INDEX IF NOT EXISTS idx_ims_consumer_stale
  ON icp_match_scores (consumer_id, is_stale)
  WHERE is_stale = TRUE;
-- Cron: mark stale scores for a consumer after profile update

CREATE INDEX IF NOT EXISTS idx_ims_stale_computed
  ON icp_match_scores (is_stale, computed_at)
  WHERE is_stale = TRUE;
-- Cron: find all stale scores to refresh in batch

-- ── 6. consumer_social_connections ───────────────────────────────
-- Connected social accounts for interest inference.
-- OAuth + sync implementation deferred. Table created now to
-- avoid a future ALTER TABLE with data already present.

CREATE TABLE IF NOT EXISTS consumer_social_connections (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                TEXT        NOT NULL,
  platform               TEXT        NOT NULL,
  -- 'instagram' | 'twitter' | 'linkedin' | 'youtube'
  encrypted_access_token TEXT,
  -- AES-256-GCM encrypted OAuth token. NULL after expiry or revocation.
  encryption_key_id      TEXT,
  inferred_interests     JSONB,
  -- { "fitness": 0.8, "travel": 0.6 } — normalised 0-1 per category
  inference_method       TEXT,
  -- 'followed_accounts' | 'public_profile_analysis'
  consent_record_id      UUID        NOT NULL,
  -- → consent_records.id. Must have active 'social' consent.
  connected_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_synced_at         TIMESTAMPTZ,
  revoked_at             TIMESTAMPTZ
  -- Soft-revocation. UNIQUE enforced below for active connections.
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_csc_user_platform_active
  ON consumer_social_connections (user_id, platform)
  WHERE revoked_at IS NULL;
-- One active connection per user per platform.
-- Revoked connections remain for audit purposes.

CREATE INDEX IF NOT EXISTS idx_csc_user_id
  ON consumer_social_connections (user_id);

CREATE INDEX IF NOT EXISTS idx_csc_last_synced
  ON consumer_social_connections (last_synced_at)
  WHERE revoked_at IS NULL;
-- Cron: find connections due for re-sync

-- ════════════════════════════════════════════════════════════════
-- ALTER EXISTING TABLES (additive only — no drops, no renames)
-- ════════════════════════════════════════════════════════════════

-- ── userProfiles: add Phase 9 signal columns ─────────────────────
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS psychographic         JSONB,
  ADD COLUMN IF NOT EXISTS social_signals        JSONB,
  ADD COLUMN IF NOT EXISTS signal_version        TEXT DEFAULT '1.0',
  ADD COLUMN IF NOT EXISTS last_signal_computed_at TIMESTAMPTZ;

-- ── brandAlertRules: add ICP-aware alert filtering ───────────────
ALTER TABLE brand_alert_rules
  ADD COLUMN IF NOT EXISTS icp_id          UUID,
  ADD COLUMN IF NOT EXISTS min_match_score INTEGER DEFAULT 60;

CREATE INDEX IF NOT EXISTS idx_bar_icp_id
  ON brand_alert_rules (icp_id)
  WHERE icp_id IS NOT NULL;

-- ── brandAlerts: add match score snapshot at alert time ──────────
ALTER TABLE brand_alerts
  ADD COLUMN IF NOT EXISTS match_score_snapshot JSONB;

-- ════════════════════════════════════════════════════════════════
-- CONSENT MIGRATION NOTE
-- ════════════════════════════════════════════════════════════════
-- After running this migration, call the application-level migration
-- to backfill consent_records from userProfiles.consent:
--
--   POST /api/admin/migrate-consent-records
--   (or call migrateAllLegacyConsents() from consentRepository.ts)
--
-- This reads { tracking, personalization, analytics, marketing }
-- from each userProfiles.consent JSONB and creates consent_records
-- rows with:
--   consent_version = 'legacy-v1.0'
--   legal_basis     = 'explicit_consent'
--   ip_address      = NULL (not captured at original grant time)
--
-- userProfiles.consent is NOT dropped here — it remains as a
-- deprecated read-only field until all code paths are migrated.
-- ════════════════════════════════════════════════════════════════

COMMIT;
