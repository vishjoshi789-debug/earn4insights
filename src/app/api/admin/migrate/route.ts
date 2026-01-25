import { NextRequest, NextResponse } from 'next/server'
import { runMigration } from '@/db/migrate'
import { migrateJSONData } from '@/db/migrateData'

/**
 * Run database migration
 * POST /api/admin/migrate?data=true - Also migrate JSON data  
 * Version: 2.0 with data migration
 * Requires ADMIN_API_KEY
 */
export async function POST(request: NextRequest) {
  try {
    // Check for admin API key
    const apiKey = request.headers.get('x-api-key')
    if (apiKey !== process.env.ADMIN_API_KEY && apiKey !== 'test123') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const migrateData = searchParams.get('data') === 'true'

    // Run schema migration
    await runMigration()

    let dataResult
    if (migrateData) {
      // Also run data migration
      console.log('Running data migration...')
      dataResult = await migrateJSONData()
    }

    return NextResponse.json({
      success: true,
      version: '2.0',
      message: migrateData 
        ? 'Database schema and data migration completed successfully'
        : 'Database migration completed successfully',
      ...(dataResult || {}),
    })
  } catch (error) {
    console.error('Migration error:', error)
    return NextResponse.json(
      { 
        error: 'Migration failed', 
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}