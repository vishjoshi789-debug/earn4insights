/**
 * Daily Send-Time Optimization Analysis Job
 * 
 * Runs daily to:
 * 1. Analyze email click rates by hour
 * 2. Calculate variance to determine if optimization is needed
 * 3. Analyze demographic segments for optimal send times
 * 4. Enable/disable optimization based on data
 * 
 * Run via: vercel cron or manual trigger
 */

import { analyzeSendTimePerformance, analyzeDemographicSegments } from '@/lib/send-time-optimizer'

export async function runSendTimeAnalysis() {
  console.log('[SendTimeAnalysisJob] Starting daily analysis...')
  
  try {
    // Analyze overall send-time performance
    const result = await analyzeSendTimePerformance()
    
    console.log('[SendTimeAnalysisJob] Overall analysis:', {
      variance: `${(result.variance * 100).toFixed(1)}%`,
      optimizationEnabled: result.optimizationEnabled,
      recommendation: result.recommendation,
    })
    
    // Analyze demographic segments
    await analyzeDemographicSegments()
    
    console.log('[SendTimeAnalysisJob] Demographic analysis complete')
    
    return {
      success: true,
      variance: result.variance,
      optimizationEnabled: result.optimizationEnabled,
      recommendation: result.recommendation,
    }
  } catch (error) {
    console.error('[SendTimeAnalysisJob] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
