import { NextRequest, NextResponse } from 'next/server'
import { migrateJSONData } from '@/db/migrateData'

/**
 * Migrate data - GET endpoint for easy testing
 * GET /api/admin/migrate-data-get
 * Requires x-api-key header with ADMIN_API_KEY
 */
export async function GET(request: NextRequest) {
  try {
    // Check for admin API key via header (query params leak in logs/referrers)
    const apiKey = request.headers.get('x-api-key')
    if (!process.env.ADMIN_API_KEY || apiKey !== process.env.ADMIN_API_KEY) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Run data migration
    const result = await migrateJSONData()

    return NextResponse.json({
      ...result,
      message: 'Data migration completed successfully',
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
