import { NextRequest, NextResponse } from 'next/server'
import { migrateAllLegacyConsents } from '@/db/repositories/consentRepository'

/**
 * Backfill consent_records from userProfiles.consent JSONB (one-time migration)
 * POST /api/admin/migrate-consent-records
 * Header: x-api-key: <ADMIN_API_KEY>
 *
 * Reads the legacy { tracking, personalization, analytics, marketing } JSONB
 * from every userProfiles row and creates individual consent_records rows.
 *
 * Idempotent — safe to call multiple times (uses onConflictDoNothing).
 */
export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key')
  if (!process.env.ADMIN_API_KEY || apiKey !== process.env.ADMIN_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { processed, skipped } = await migrateAllLegacyConsents()

    return NextResponse.json({
      success: true,
      message: 'Legacy consent backfill complete.',
      processed,
      skipped,
      note: 'userProfiles.consent JSONB is now deprecated. All new consent reads/writes use consent_records.',
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message ?? String(error) },
      { status: 500 }
    )
  }
}
