import { NextRequest, NextResponse } from 'next/server'
import { batchUpdateBehavioralAttributes } from '@/server/analyticsService'

/**
 * API Route for Cron Job: Update Behavioral Attributes
 * Called daily by Vercel Cron
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret to prevent unauthorized access
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    console.log('[Cron] Starting behavioral attributes update...')
    
    await batchUpdateBehavioralAttributes()
    
    console.log('[Cron] ✓ Behavioral attributes updated successfully')

    return NextResponse.json({
      success: true,
      message: 'Behavioral attributes updated successfully',
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('[Cron] Error updating behavioral attributes:', error)
    
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
