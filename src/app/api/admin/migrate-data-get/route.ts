import { NextRequest, NextResponse } from 'next/server'
import { migrateJSONData } from '@/db/migrateData'

/**
 * Migrate data - GET endpoint for easy testing
 * GET /api/admin/migrate-data-get?key=test123
 */
export async function GET(request: NextRequest) {
  try {
    // Check for admin API key in query params
    const { searchParams } = new URL(request.url)
    const apiKey = searchParams.get('key')
    
    if (apiKey !== 'test123') {
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
