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
    if (!process.env.ADMIN_API_KEY || apiKey !== process.env.ADMIN_API_KEY) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid API key' },
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
