import { NextRequest, NextResponse } from 'next/server'
import { pgClient } from '@/db'

/**
 * Run migration 026: Email verification (Phase EV.1)
 * POST /api/admin/run-migration-026
 * Header: x-api-key: <ADMIN_API_KEY>
 *
 * Adds:
 *   - users.email_verified_at TIMESTAMP NULL
 *     (NULL = not verified; timestamp = when verified)
 *
 *   - email_verification_tokens table:
 *       id           UUID PK
 *       user_id      TEXT NOT NULL (FK users(id) CASCADE)
 *       token_hash   TEXT NOT NULL (SHA-256 of the plaintext token)
 *       expires_at   TIMESTAMP NOT NULL (24h from creation)
 *       used_at      TIMESTAMP NULL (set when consumed)
 *       created_at   TIMESTAMP NOT NULL DEFAULT NOW()
 *
 *   - Indexes:
 *       idx_email_verification_tokens_token_hash (token lookup at verify)
 *       idx_email_verification_tokens_user_id (resend invalidation lookup)
 *       idx_email_verification_tokens_expires_at (cleanup cron)
 *
 *   - Backfill: Google-signup users (users.google_id IS NOT NULL) get
 *     email_verified_at = created_at on the assumption that Google
 *     verified the email before issuing the OAuth token (industry
 *     standard for OAuth providers).
 *
 * Idempotent: ADD COLUMN IF NOT EXISTS + CREATE TABLE IF NOT EXISTS +
 * CREATE INDEX IF NOT EXISTS + DO-block FK constraint check throughout.
 *
 * Mirrors the password_reset_tokens shape (schema.ts:984) so callers
 * familiar with one will recognise the other instantly.
 */
export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key')
  if (!process.env.ADMIN_API_KEY || apiKey !== process.env.ADMIN_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: { name: string; status: string; affected?: number }[] = []

  try {
    // ── users.email_verified_at ───────────────────────────────────
    await pgClient.unsafe(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMP
    `)
    results.push({ name: 'users.email_verified_at', status: 'added' })

    // ── email_verification_tokens table ───────────────────────────
    await pgClient.unsafe(`
      CREATE TABLE IF NOT EXISTS email_verification_tokens (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id     TEXT NOT NULL,
        token_hash  TEXT NOT NULL,
        expires_at  TIMESTAMP NOT NULL,
        used_at     TIMESTAMP,
        created_at  TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `)
    results.push({ name: 'email_verification_tokens', status: 'created' })

    // FK CASCADE → users(id). DO-block so re-runs don't fail with
    // "constraint already exists". Same pattern as migrations 011/021.
    await pgClient.unsafe(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'fk_email_verification_tokens_user'
        ) THEN
          ALTER TABLE email_verification_tokens
            ADD CONSTRAINT fk_email_verification_tokens_user
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
        END IF;
      END $$
    `)
    results.push({ name: 'fk_email_verification_tokens_user', status: 'ensured' })

    // Token lookup at verify time — by far the hottest query.
    await pgClient.unsafe(`
      CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_token_hash
        ON email_verification_tokens (token_hash)
    `)
    results.push({ name: 'idx_email_verification_tokens_token_hash', status: 'created' })

    // Per-user lookup at resend time (invalidate prior unused tokens).
    await pgClient.unsafe(`
      CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_user_id
        ON email_verification_tokens (user_id)
    `)
    results.push({ name: 'idx_email_verification_tokens_user_id', status: 'created' })

    // Cleanup cron's expiry scan.
    await pgClient.unsafe(`
      CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_expires_at
        ON email_verification_tokens (expires_at)
    `)
    results.push({ name: 'idx_email_verification_tokens_expires_at', status: 'created' })

    // ── Google-signup backfill ────────────────────────────────────
    // OAuth providers verify the email before issuing tokens, so a row
    // with google_id IS NOT NULL had its email verified by Google.
    // Treat created_at as the verification moment. Idempotent — WHERE
    // also includes email_verified_at IS NULL so re-runs don't thrash.
    const googleBackfill = await pgClient.unsafe<{ count: string }[]>(`
      WITH updated AS (
        UPDATE users
          SET email_verified_at = created_at
          WHERE google_id IS NOT NULL AND email_verified_at IS NULL
          RETURNING 1
      )
      SELECT COUNT(*)::text AS count FROM updated
    `)
    results.push({
      name: 'backfill email_verified_at WHERE google_id IS NOT NULL',
      status: 'done',
      affected: Number(googleBackfill?.[0]?.count ?? 0),
    })

    return NextResponse.json({
      success: true,
      message: 'Migration 026 completed: email verification schema + Google backfill',
      results,
    })
  } catch (error) {
    console.error('[Migration 026] Error:', error)
    return NextResponse.json(
      {
        error: 'Migration 026 failed',
        details: error instanceof Error ? error.message : String(error),
        completedSteps: results,
      },
      { status: 500 },
    )
  }
}
