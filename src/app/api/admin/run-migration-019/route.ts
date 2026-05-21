import { NextRequest, NextResponse } from 'next/server'
import { pgClient } from '@/db'

/**
 * Run migration 019: Two-Factor Authentication (2FA / TOTP)
 * POST /api/admin/run-migration-019
 * Header: x-api-key: <ADMIN_API_KEY>
 *
 * Adds:
 *   - users.two_factor_enabled BOOLEAN NOT NULL DEFAULT false
 *   - user_totp_secrets   — one TOTP secret per user (AES-256-GCM, versioned;
 *     encryption_key_id stored alongside the ciphertext so it can be decrypted)
 *   - user_recovery_codes — single-use, bcrypt-hashed recovery codes
 *   - trusted_devices     — 30-day "skip the 2FA challenge" records
 *
 * All FKs CASCADE → users (a deleted account drops its 2FA data — GDPR Art. 17).
 * Idempotent: ADD COLUMN / CREATE TABLE / CREATE INDEX all use IF NOT EXISTS.
 */
export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key')
  if (!process.env.ADMIN_API_KEY || apiKey !== process.env.ADMIN_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: { name: string; status: string }[] = []

  try {
    await pgClient.unsafe(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN NOT NULL DEFAULT false
    `)
    results.push({ name: 'users.two_factor_enabled', status: 'added' })

    await pgClient.unsafe(`
      CREATE TABLE IF NOT EXISTS user_totp_secrets (
        id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id           TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        encrypted_secret  TEXT NOT NULL,
        encryption_key_id TEXT NOT NULL,
        is_enabled        BOOLEAN NOT NULL DEFAULT false,
        verified_at       TIMESTAMP,
        last_used_at      TIMESTAMP,
        created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at        TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `)
    results.push({ name: 'user_totp_secrets', status: 'created' })

    await pgClient.unsafe(`
      CREATE TABLE IF NOT EXISTS user_recovery_codes (
        id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        code_hash  TEXT NOT NULL,
        is_used    BOOLEAN NOT NULL DEFAULT false,
        used_at    TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `)
    results.push({ name: 'user_recovery_codes', status: 'created' })

    await pgClient.unsafe(`
      CREATE INDEX IF NOT EXISTS idx_recovery_codes_user
        ON user_recovery_codes (user_id)
    `)
    results.push({ name: 'idx_recovery_codes_user', status: 'created' })

    await pgClient.unsafe(`
      CREATE TABLE IF NOT EXISTS trusted_devices (
        id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id            TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        device_fingerprint TEXT NOT NULL,
        device_name        TEXT NOT NULL,
        last_used_at       TIMESTAMP NOT NULL DEFAULT NOW(),
        expires_at         TIMESTAMP NOT NULL,
        created_at         TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `)
    results.push({ name: 'trusted_devices', status: 'created' })

    await pgClient.unsafe(`
      CREATE INDEX IF NOT EXISTS idx_trusted_devices_user_fp
        ON trusted_devices (user_id, device_fingerprint)
    `)
    results.push({ name: 'idx_trusted_devices_user_fp', status: 'created' })

    await pgClient.unsafe(`
      CREATE INDEX IF NOT EXISTS idx_trusted_devices_expires
        ON trusted_devices (expires_at)
    `)
    results.push({ name: 'idx_trusted_devices_expires', status: 'created' })

    return NextResponse.json({
      success: true,
      message: 'Migration 019 completed: Two-Factor Authentication',
      results,
    })
  } catch (error) {
    console.error('[Migration 019] Error:', error)
    return NextResponse.json(
      {
        error: 'Migration 019 failed',
        details: error instanceof Error ? error.message : String(error),
        completedSteps: results,
      },
      { status: 500 },
    )
  }
}
