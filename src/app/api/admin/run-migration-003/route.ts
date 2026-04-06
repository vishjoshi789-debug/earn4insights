import { NextRequest, NextResponse } from 'next/server'
import { pgClient } from '@/db'

/**
 * Run migration 003: Foreign Keys & Constraint Hardening
 * POST /api/admin/run-migration-003
 * Header: x-api-key: <ADMIN_API_KEY>
 *
 * Adds FK constraints to all 6 tables from migration 002.
 * Replaces the table-level UNIQUE on consumer_sensitive_attributes
 * with a partial unique index (WHERE deleted_at IS NULL).
 *
 * Prerequisite: migration 002 must be applied first.
 */
export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key')
  if (!process.env.ADMIN_API_KEY || apiKey !== process.env.ADMIN_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Run each ALTER separately — if constraint already exists, catch and continue.
    // This makes the migration idempotent.
    const statements = [
      {
        name: 'FK consumer_signal_snapshots.user_id → user_profiles.id',
        sql: `ALTER TABLE consumer_signal_snapshots
              ADD CONSTRAINT fk_css_user_id
              FOREIGN KEY (user_id) REFERENCES user_profiles (id) ON DELETE CASCADE`,
      },
      {
        name: 'FK consent_records.user_id → user_profiles.id',
        sql: `ALTER TABLE consent_records
              ADD CONSTRAINT fk_cr_user_id
              FOREIGN KEY (user_id) REFERENCES user_profiles (id) ON DELETE CASCADE`,
      },
      {
        name: 'FK consumer_sensitive_attributes.user_id → user_profiles.id',
        sql: `ALTER TABLE consumer_sensitive_attributes
              ADD CONSTRAINT fk_csa_user_id
              FOREIGN KEY (user_id) REFERENCES user_profiles (id) ON DELETE CASCADE`,
      },
      {
        name: 'FK consumer_sensitive_attributes.consent_record_id → consent_records.id',
        sql: `ALTER TABLE consumer_sensitive_attributes
              ADD CONSTRAINT fk_csa_consent_record_id
              FOREIGN KEY (consent_record_id) REFERENCES consent_records (id) ON DELETE CASCADE`,
      },
      {
        name: 'Drop old UNIQUE on consumer_sensitive_attributes',
        sql: `ALTER TABLE consumer_sensitive_attributes
              DROP CONSTRAINT IF EXISTS uq_sensitive_user_category`,
      },
      {
        name: 'Partial UNIQUE index on consumer_sensitive_attributes (active only)',
        sql: `CREATE UNIQUE INDEX IF NOT EXISTS uq_csa_user_category_active
              ON consumer_sensitive_attributes (user_id, attribute_category)
              WHERE deleted_at IS NULL`,
      },
      {
        name: 'FK brand_icps.brand_id → user_profiles.id',
        sql: `ALTER TABLE brand_icps
              ADD CONSTRAINT fk_bi_brand_id
              FOREIGN KEY (brand_id) REFERENCES user_profiles (id) ON DELETE CASCADE`,
      },
      {
        name: 'FK icp_match_scores.icp_id → brand_icps.id',
        sql: `ALTER TABLE icp_match_scores
              ADD CONSTRAINT fk_ims_icp_id
              FOREIGN KEY (icp_id) REFERENCES brand_icps (id) ON DELETE CASCADE`,
      },
      {
        name: 'FK icp_match_scores.consumer_id → user_profiles.id',
        sql: `ALTER TABLE icp_match_scores
              ADD CONSTRAINT fk_ims_consumer_id
              FOREIGN KEY (consumer_id) REFERENCES user_profiles (id) ON DELETE CASCADE`,
      },
      {
        name: 'FK consumer_social_connections.user_id → user_profiles.id',
        sql: `ALTER TABLE consumer_social_connections
              ADD CONSTRAINT fk_csc_user_id
              FOREIGN KEY (user_id) REFERENCES user_profiles (id) ON DELETE CASCADE`,
      },
      {
        name: 'FK consumer_social_connections.consent_record_id → consent_records.id',
        sql: `ALTER TABLE consumer_social_connections
              ADD CONSTRAINT fk_csc_consent_record_id
              FOREIGN KEY (consent_record_id) REFERENCES consent_records (id) ON DELETE CASCADE`,
      },
      {
        name: 'FK brand_alert_rules.icp_id → brand_icps.id',
        sql: `ALTER TABLE brand_alert_rules
              ADD CONSTRAINT fk_bar_icp_id
              FOREIGN KEY (icp_id) REFERENCES brand_icps (id) ON DELETE SET NULL`,
      },
    ]

    const results: { name: string; status: 'ok' | 'skipped'; detail?: string }[] = []

    for (const stmt of statements) {
      try {
        await pgClient.unsafe(stmt.sql)
        results.push({ name: stmt.name, status: 'ok' })
      } catch (e: any) {
        // 42710 = duplicate_object (constraint already exists)
        if (e?.code === '42710') {
          results.push({ name: stmt.name, status: 'skipped', detail: 'Already exists' })
        } else {
          throw e
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Migration 003 applied successfully. FK constraints and partial UNIQUE index added.',
      results,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    const detail = {
      message: error?.message,
      code: error?.code,
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
