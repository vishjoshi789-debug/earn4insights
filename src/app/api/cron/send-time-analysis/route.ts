import { NextResponse } from 'next/server'
import { runSendTimeAnalysis } from '@/jobs/sendTimeAnalysisJob'

/**
 * API Route: Daily Send-Time Optimization Analysis
 * 
 * Trigger: Vercel Cron (daily at 2am UTC)
 * Purpose: Analyze email engagement and optimize send times
 * 
 * Manual trigger: GET /api/cron/send-time-analysis
 */
export async function GET(request: Request) {
  // Verify cron secret (Vercel Cron sends this header)
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  try {
    const result = await runSendTimeAnalysis()
    
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...result,
    })
  } catch (error) {
    console.error('[SendTimeAnalysisCron] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, { status: 500 })
  }
}
