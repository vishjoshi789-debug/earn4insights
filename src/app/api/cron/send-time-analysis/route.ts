import { NextResponse } from 'next/server'
import { withCronRun } from '@/lib/cron/withCronRun'
import { runSendTimeAnalysis } from '@/jobs/sendTimeAnalysisJob'
import { logger } from '@/lib/logger'

/**
 * API Route: Daily Send-Time Optimization Analysis
 * 
 * Trigger: Vercel Cron (daily at 2am UTC)
 * Purpose: Analyze email engagement and optimize send times
 * 
 * Manual trigger: GET /api/cron/send-time-analysis
 */
// Run-recording (migration 037).
// ⚠️ This route is the ONLY one that compares unconditionally against
// `Bearer ${process.env.CRON_SECRET}` with no `cronSecret &&` guard — so
// unlike the majority it does NOT fall open when the secret is unset. That
// difference is deliberate-looking and is preserved exactly: the check stays
// inline, and the wrapper adds recording only.
export const GET = withCronRun('send-time-analysis', handleGET)

async function handleGET(request: Request) {
  // Verify cron secret (Vercel Cron sends this header)
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  try {
    const result = await runSendTimeAnalysis()
    
    // Destructure to avoid duplicate 'success' key
    const { success, ...rest } = result
    
    logger.cronResult('send-time-analysis', true, rest)

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...rest,
    })
  } catch (error) {
    logger.cronResult('send-time-analysis', false, { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, { status: 500 })
  }
}
