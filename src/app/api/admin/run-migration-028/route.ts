import { NextRequest, NextResponse } from 'next/server'
import { pgClient } from '@/db'

/**
 * Run migration 028: Influencer verification requests (Phase A9).
 * POST /api/admin/run-migration-028
 * Header: x-api-key: <ADMIN_API_KEY>
 *
 * Adds:
 *   - influencer_verification_requests table — append-only history of
 *     every verification attempt (7 lifecycle statuses). The current
 *     state continues to live on influencer_profiles.verification_status
 *     (3 values: unverified / pending / verified).
 *
 *   - Indexes:
 *       idx_ivr_status_created       (admin queue list: ORDER BY created_at)
 *       idx_ivr_user_id              (user-side status lookup)
 *       uq_ivr_user_open_request     PARTIAL UNIQUE on user_id WHERE
 *                                    status IN ('pending', 'manual_review',
 *                                    'needs_info') — one open request per
 *                                    user; closed/decided requests don't
 *                                    block re-application.
 *
 *   - FKs:
 *       fk_ivr_user           user_id     → users(id) ON DELETE CASCADE
 *       fk_ivr_reviewer       reviewer_id → users(id) ON DELETE SET NULL
 *
 * Idempotent: ADD COLUMN IF NOT EXISTS not needed (no column changes);
 * CREATE TABLE IF NOT EXISTS + CREATE INDEX IF NOT EXISTS + DO-block
 * checks on pg_constraint for both FKs.
 *
 * Pattern parallel: migration 026 (email_verification_tokens) for
 * "append-only history + FK CASCADE → users" shape; migration 015
 * (support_tickets) for "lifecycle status enum + admin queue index".
 */
export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key')
  if (!process.env.ADMIN_API_KEY || apiKey !== process.env.ADMIN_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: { name: string; status: string }[] = []

  try {
    // ── Table ─────────────────────────────────────────────────────
    await pgClient.unsafe(`
      CREATE TABLE IF NOT EXISTS influencer_verification_requests (
        id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id                  TEXT NOT NULL,
        status                   TEXT NOT NULL DEFAULT 'pending',
        application_message      TEXT,
        brand_contact_notes      TEXT,
        portfolio_links          JSONB NOT NULL DEFAULT '[]'::jsonb,
        proof_documents          JSONB NOT NULL DEFAULT '[]'::jsonb,
        threshold_check_result   JSONB,
        reviewer_id              TEXT,
        review_notes             TEXT,
        reviewed_at              TIMESTAMP,
        eligible_to_reapply_at   TIMESTAMP,
        created_at               TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at               TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `)
    results.push({ name: 'influencer_verification_requests', status: 'created' })

    // ── Status CHECK constraint (DO-block for idempotency) ────────
    await pgClient.unsafe(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'ivr_status_check'
        ) THEN
          ALTER TABLE influencer_verification_requests
            ADD CONSTRAINT ivr_status_check
            CHECK (status IN (
              'pending', 'auto_approved', 'auto_rejected',
              'manual_review', 'approved', 'rejected', 'needs_info'
            ));
        END IF;
      END $$
    `)
    results.push({ name: 'ivr_status_check', status: 'ensured' })

    // ── FK: user_id → users(id) ON DELETE CASCADE ────────────────
    await pgClient.unsafe(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'fk_ivr_user'
        ) THEN
          ALTER TABLE influencer_verification_requests
            ADD CONSTRAINT fk_ivr_user
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
        END IF;
      END $$
    `)
    results.push({ name: 'fk_ivr_user', status: 'ensured' })

    // ── FK: reviewer_id → users(id) ON DELETE SET NULL ───────────
    await pgClient.unsafe(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'fk_ivr_reviewer'
        ) THEN
          ALTER TABLE influencer_verification_requests
            ADD CONSTRAINT fk_ivr_reviewer
            FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE SET NULL;
        END IF;
      END $$
    `)
    results.push({ name: 'fk_ivr_reviewer', status: 'ensured' })

    // ── Admin queue index ────────────────────────────────────────
    await pgClient.unsafe(`
      CREATE INDEX IF NOT EXISTS idx_ivr_status_created
        ON influencer_verification_requests (status, created_at DESC)
    `)
    results.push({ name: 'idx_ivr_status_created', status: 'created' })

    // ── Per-user lookup ──────────────────────────────────────────
    await pgClient.unsafe(`
      CREATE INDEX IF NOT EXISTS idx_ivr_user_id
        ON influencer_verification_requests (user_id)
    `)
    results.push({ name: 'idx_ivr_user_id', status: 'created' })

    // ── One-open-request-per-user (partial UNIQUE) ───────────────
    // Closed statuses (auto_approved / auto_rejected / approved /
    // rejected) don't block re-application — the cooldown is enforced
    // by `eligible_to_reapply_at`, not the index.
    await pgClient.unsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_ivr_user_open_request
        ON influencer_verification_requests (user_id)
        WHERE status IN ('pending', 'manual_review', 'needs_info')
    `)
    results.push({ name: 'uq_ivr_user_open_request', status: 'created' })

    return NextResponse.json({
      success: true,
      message: 'Migration 028 completed: influencer_verification_requests table + 2 FKs + 3 indexes',
      results,
    })
  } catch (error) {
    console.error('[Migration 028] Error:', error)
    return NextResponse.json(
      {
        error: 'Migration 028 failed',
        details: error instanceof Error ? error.message : String(error),
        completedSteps: results,
      },
      { status: 500 },
    )
  }
}
