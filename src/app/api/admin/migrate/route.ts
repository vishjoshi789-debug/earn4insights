import { NextRequest, NextResponse } from 'next/server'
import { runMigration } from '@/db/migrate'

/**
 * Run database migration
 * POST /api/admin/migrate
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

    // Run migration
    await runMigration()

    return NextResponse.json({
      success: true,
      message: 'Database migration completed successfully',
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
