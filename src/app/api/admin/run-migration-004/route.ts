import { NextRequest, NextResponse } from 'next/server'
import { pgClient } from '@/db'
import fs from 'fs'
import path from 'path'

/**
 * Run migration 004: Influencers Adda
 * POST /api/admin/run-migration-004
 * Header: x-api-key: <ADMIN_API_KEY>
 *
 * Creates 11 new tables (10 + campaign_disputes), ALTERs users table,
 * adds indexes, and wires deferred FK constraints.
 *
 * Prerequisite: migrations 001-003 must be applied first.
 * Idempotent: all statements use IF NOT EXISTS.
 */
export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key')
  if (!process.env.ADMIN_API_KEY || apiKey !== process.env.ADMIN_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const migrationPath = path.join(
      process.cwd(),
      'src/db/migrations/004_influencer_adda.sql'
    )
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8')

    // Strip BEGIN/COMMIT — postgres.js blocks transaction control on pooled connections.
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
      message: 'Migration 004 (Influencers Adda) applied successfully. 11 tables created, users table altered.',
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
