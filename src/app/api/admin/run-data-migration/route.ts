import { NextRequest, NextResponse } from 'next/server'
import { migrateJSONData } from '@/db/migrateData'

/**
 * Run ONLY data migration (schema should already exist)
 * POST /api/admin/run-data-migration
 * Requires x-api-key header
 */
export async function POST(request: NextRequest) {
  try {
    // Check for admin API key
    const apiKey = request.headers.get('x-api-key')
    if (apiKey !== 'test123' && apiKey !== process.env.ADMIN_API_KEY) {
      return NextResponse.json(
        { error: 'Unauthorized', received: apiKey ? 'key provided' : 'no key' },
        { status: 401 }
      )
    }

    console.log('Starting data migration from JSON files...')
    
    // Run data migration
    const result = await migrateJSONData()

    console.log('Data migration completed:', result)

    return NextResponse.json({
      ...result,
      timestamp: new Date().toISOString(),
      endpoint: 'run-data-migration',
      version: '1.0',
    })
  } catch (error) {
    console.error('Data migration error:', error)
    return NextResponse.json(
      { 
        success: false,
        error: 'Data migration failed', 
        details: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}

// Also support GET for easy browser testing
export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'Data migration endpoint. Use POST with x-api-key header to run migration.',
    usage: 'POST /api/admin/run-data-migration with header: x-api-key: test123',
  })
}
