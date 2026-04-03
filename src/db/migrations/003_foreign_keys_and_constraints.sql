-- ════════════════════════════════════════════════════════════════
-- Migration 003: Foreign Keys & Constraint Hardening
-- ════════════════════════════════════════════════════════════════
-- Adds FK constraints to all 6 tables created in migration 002.
-- Replaces the table-level UNIQUE on consumer_sensitive_attributes
-- with a partial unique index (WHERE deleted_at IS NULL).
--
-- Run via: POST /api/admin/run-migration-003
-- ════════════════════════════════════════════════════════════════

BEGIN;

-- ── consumer_signal_snapshots ─────────────────────────────────────
-- user_id → user_profiles.id
ALTER TABLE consumer_signal_snapshots
  ADD CONSTRAINT fk_css_user_id
    FOREIGN KEY (user_id)
    REFERENCES user_profiles (id)
    ON DELETE CASCADE;

-- ── consent_records ───────────────────────────────────────────────
-- user_id → user_profiles.id
ALTER TABLE consent_records
  ADD CONSTRAINT fk_cr_user_id
    FOREIGN KEY (user_id)
    REFERENCES user_profiles (id)
    ON DELETE CASCADE;

-- ── consumer_sensitive_attributes ────────────────────────────────
-- user_id → user_profiles.id
ALTER TABLE consumer_sensitive_attributes
  ADD CONSTRAINT fk_csa_user_id
    FOREIGN KEY (user_id)
    REFERENCES user_profiles (id)
    ON DELETE CASCADE;

-- consent_record_id → consent_records.id
ALTER TABLE consumer_sensitive_attributes
  ADD CONSTRAINT fk_csa_consent_record_id
    FOREIGN KEY (consent_record_id)
    REFERENCES consent_records (id)
    ON DELETE CASCADE;

-- Fix 6: Replace table-level UNIQUE with partial unique index.
-- The old UNIQUE prevents re-inserting after soft-delete.
ALTER TABLE consumer_sensitive_attributes
  DROP CONSTRAINT IF EXISTS uq_sensitive_user_category;

CREATE UNIQUE INDEX IF NOT EXISTS uq_csa_user_category_active
  ON consumer_sensitive_attributes (user_id, attribute_category)
  WHERE deleted_at IS NULL;

-- ── brand_icps ───────────────────────────────────────────────────
-- brand_id → user_profiles.id (brand user)
ALTER TABLE brand_icps
  ADD CONSTRAINT fk_bi_brand_id
    FOREIGN KEY (brand_id)
    REFERENCES user_profiles (id)
    ON DELETE CASCADE;

-- ── icp_match_scores ─────────────────────────────────────────────
-- icp_id → brand_icps.id
ALTER TABLE icp_match_scores
  ADD CONSTRAINT fk_ims_icp_id
    FOREIGN KEY (icp_id)
    REFERENCES brand_icps (id)
    ON DELETE CASCADE;

-- consumer_id → user_profiles.id
ALTER TABLE icp_match_scores
  ADD CONSTRAINT fk_ims_consumer_id
    FOREIGN KEY (consumer_id)
    REFERENCES user_profiles (id)
    ON DELETE CASCADE;

-- ── consumer_social_connections ──────────────────────────────────
-- user_id → user_profiles.id
ALTER TABLE consumer_social_connections
  ADD CONSTRAINT fk_csc_user_id
    FOREIGN KEY (user_id)
    REFERENCES user_profiles (id)
    ON DELETE CASCADE;

-- consent_record_id → consent_records.id
ALTER TABLE consumer_social_connections
  ADD CONSTRAINT fk_csc_consent_record_id
    FOREIGN KEY (consent_record_id)
    REFERENCES consent_records (id)
    ON DELETE CASCADE;

-- ── brand_alert_rules.icp_id → brand_icps.id ────────────────────
-- icp_id is nullable — SET NULL so deleting an ICP doesn't delete the rule
ALTER TABLE brand_alert_rules
  ADD CONSTRAINT fk_bar_icp_id
    FOREIGN KEY (icp_id)
    REFERENCES brand_icps (id)
    ON DELETE SET NULL;

COMMIT;
