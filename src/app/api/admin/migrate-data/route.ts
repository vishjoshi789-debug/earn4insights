import { NextRequest, NextResponse } from 'next/server'
import { migrateJSONData } from '@/db/migrateData'

/**
 * Migrate JSON data to Postgres
 * POST /api/admin/migrate-data
 * Requires ADMIN_API_KEY
 */
export async function POST(request: NextRequest) {
  try {
    // Check for admin API key
    const apiKey = request.headers.get('x-api-key')
    if (apiKey !== process.env.ADMIN_API_KEY) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Run data migration
    const result = await migrateJSONData()

    return NextResponse.json({
      success: true,
      message: 'Data migration completed successfully',
      ...result,
    })
  } catch (error) {
    console.error('Data migration error:', error)
    return NextResponse.json(
      { 
        error: 'Data migration failed', 
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
