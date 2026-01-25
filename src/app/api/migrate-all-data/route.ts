import { NextResponse } from 'next/server'
import { migrateJSONData } from '@/db/migrateData'

/**
 * Simple data migration endpoint
 * GET /api/migrate-all-data?key=test123
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const key = searchParams.get('key')
    
    if (key !== 'test123') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('🚀 Starting data migration...')
    const result = await migrateJSONData()
    console.log('✅ Migration complete:', result)

    return NextResponse.json({
      ...result,
      timestamp: new Date().toISOString(),
      message: 'Data migration completed',
    })
  } catch (error: any) {
    console.error('❌ Migration failed:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}
