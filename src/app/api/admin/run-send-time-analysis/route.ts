import { NextResponse } from 'next/server'
import { runSendTimeAnalysis } from '@/jobs/sendTimeAnalysisJob'

/**
 * API Route: Run Send-Time Analysis
 * 
 * Manually trigger the send-time optimization analysis
 * (normally runs via cron daily at 3am UTC)
 */
export async function POST() {
  try {
    const result = await runSendTimeAnalysis()
    
    // Destructure to avoid duplicate 'success' key
    const { success, ...rest } = result
    
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...rest,
    })
  } catch (error) {
    console.error('[RunSendTimeAnalysis] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, { status: 500 })
  }
}
