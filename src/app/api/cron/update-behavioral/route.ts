import { NextRequest, NextResponse } from 'next/server'
import { batchUpdateBehavioralAttributes } from '@/server/analyticsService'
import { logger } from '@/lib/logger'

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

    await batchUpdateBehavioralAttributes()
    
    logger.cronResult('update-behavioral', true)

    return NextResponse.json({
      success: true,
      message: 'Behavioral attributes updated successfully',
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    logger.cronResult('update-behavioral', false, { error: error instanceof Error ? error.message : String(error) })
    
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
