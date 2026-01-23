import { NextRequest, NextResponse } from 'next/server'
import { migrateProductCategories } from '@/server/rankings/migrationScript'

/**
 * POST /api/admin/migrate-categories
 * 
 * Migrate existing products to include categories
 * 
 * Body: { dryRun?: boolean }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const dryRun = body.dryRun !== false // Default to true

    console.log(`🔄 Category migration triggered (dry run: ${dryRun})`)

    const result = await migrateProductCategories(dryRun)

    return NextResponse.json({
      success: result.success,
      dryRun,
      summary: {
        total: result.migratedCount + result.skippedCount + result.errorCount,
        migrated: result.migratedCount,
        skipped: result.skippedCount,
        errors: result.errorCount,
      },
      details: result.details,
      message: dryRun
        ? 'Dry run complete. Set dryRun=false to actually migrate.'
        : 'Migration complete!',
    }, {
      status: result.success ? 200 : 500,
    })
  } catch (error) {
    console.error('❌ Migration failed:', error)

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, {
      status: 500,
    })
  }
}
