import { NextRequest, NextResponse } from 'next/server'
import { pgClient } from '@/db'
import fs from 'fs'
import path from 'path'

/**
 * Run migration 002: Hyper-Personalization Engine
 * POST /api/admin/run-migration-002
 * Header: x-api-key: <ADMIN_API_KEY>
 *
 * Creates 6 new tables and alters 3 existing tables.
 * Uses the same db instance as the rest of the app — safe for local dev.
 * Idempotent: all statements use IF NOT EXISTS / IF NOT EXISTS on indexes.
 */
export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key')
  if (!process.env.ADMIN_API_KEY || apiKey !== process.env.ADMIN_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: { statement: string; status: 'ok' | 'skipped' | 'error'; detail?: string }[] = []

  try {
    const migrationPath = path.join(
      process.cwd(),
      'src/db/migrations/002_hyper_personalization.sql'
    )
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8')

    // Strip BEGIN/COMMIT — postgres.js blocks unsafe() containing transaction
    // control statements on a pooled connection. Every DDL statement uses
    // IF NOT EXISTS so idempotency is preserved without the wrapper.
    const strippedSQL = migrationSQL
      .split('\n')
      .filter(line => {
        const trimmed = line.trim().toUpperCase()
        return trimmed !== 'BEGIN;' && trimmed !== 'COMMIT;' &&
               trimmed !== 'BEGIN' && trimmed !== 'COMMIT'
      })
      .join('\n')

    await pgClient.unsafe(strippedSQL)
    results.push({ statement: 'full migration', status: 'ok' })

    const counts = {
      ok: results.filter(r => r.status === 'ok').length,
      skipped: results.filter(r => r.status === 'skipped').length,
    }

    return NextResponse.json({
      success: true,
      message: 'Migration 002 applied successfully.',
      counts,
      results,
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
      query: error?.query,
      str: String(error),
    }
    return NextResponse.json(
      { success: false, error: detail, results },
      { status: 500 }
    )
  }
}
