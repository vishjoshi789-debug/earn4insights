import { NextRequest, NextResponse } from 'next/server'
import { batchUpdateBehavioralAttributes } from '@/server/analyticsService'

/**
 * API endpoint to trigger behavioral attributes update
 * 
 * Can be called by:
 * 1. Vercel Cron Jobs
 * 2. External cron services
 * 3. Manual trigger for testing
 * 
 * Security: Add Authorization header check in production
 */
export async function GET(request: NextRequest) {
  // Optional: Check authorization header
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  console.log('[API] Behavioral attributes update triggered')
  const startTime = Date.now()

  try {
    await batchUpdateBehavioralAttributes()
    
    const duration = Date.now() - startTime
    console.log(`[API] ✅ Behavioral attributes updated in ${duration}ms`)

    return NextResponse.json({
      success: true,
      duration,
      timestamp: new Date().toISOString(),
      message: 'Behavioral attributes updated successfully'
    })
  } catch (error) {
    console.error('[API] ❌ Error updating behavioral attributes:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

// Allow POST as well for manual triggers
export async function POST(request: NextRequest) {
  return GET(request)
}
