import { NextRequest, NextResponse } from 'next/server'
import { pgClient } from '@/db'
import fs from 'fs'
import path from 'path'

/**
 * Run migration 003: Foreign Keys & Constraint Hardening
 * POST /api/admin/run-migration-003
 * Header: x-api-key: <ADMIN_API_KEY>
 *
 * Adds FK constraints to all 6 new tables from migration 002.
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
    const migrationPath = path.join(
      process.cwd(),
      'src/db/migrations/003_foreign_keys_and_constraints.sql'
    )
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8')

    // Strip BEGIN/COMMIT — postgres.js blocks unsafe() containing transaction
    // control statements on a pooled connection.
    const strippedSQL = migrationSQL
      .split('\n')
      .filter(line => {
        const trimmed = line.trim().toUpperCase()
        return trimmed !== 'BEGIN;' && trimmed !== 'COMMIT;' &&
               trimmed !== 'BEGIN' && trimmed !== 'COMMIT'
      })
      .join('\n')

    await pgClient.unsafe(strippedSQL)

    return NextResponse.json({
      success: true,
      message: 'Migration 003 applied successfully. FK constraints and partial UNIQUE index added.',
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
