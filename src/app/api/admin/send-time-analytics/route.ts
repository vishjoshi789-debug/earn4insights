import { NextResponse } from 'next/server'
import { db } from '@/db'
import { 
  sendTimeAnalytics, 
  demographicPerformance, 
  sendTimeCohorts,
  emailSendEvents 
} from '@/db/schema'
import { eq, sql } from 'drizzle-orm'

/**
 * API Route: Get Send-Time Analytics
 * 
 * Returns comprehensive send-time optimization data:
 * - Variance analysis
 * - Hourly click rates
 * - Demographic performance
 * - Cohort A/B test results
 */
export async function GET(request: Request) {
  try {
    const today = new Date().toISOString().split('T')[0]
    
    // Get today's overall analytics
    const overallAnalytics = await db.select()
      .from(sendTimeAnalytics)
      .where(eq(sendTimeAnalytics.analysisDate, today))
      .orderBy(sendTimeAnalytics.sendHour)
    
    // Calculate overall variance and optimization status
    const clickRates = overallAnalytics
      .filter(a => a.sampleSize && a.sampleSize >= 100)
      .map(a => parseFloat(a.clickRate || '0'))
    
    const variance = calculateVariance(clickRates)
    const optimizationEnabled = overallAnalytics[0]?.optimizationEnabled || false
    
    let recommendation = ''
    if (clickRates.length < 3) {
      recommendation = 'Insufficient data. Need at least 3 hours with 100+ emails each to analyze.'
    } else if (variance > 0.30) {
      recommendation = `High variance (${(variance * 100).toFixed(1)}%) detected. ✅ ENABLE OPTIMIZATION - personalized send times will significantly improve engagement.`
    } else if (variance < 0.15) {
      recommendation = `Low variance (${(variance * 100).toFixed(1)}%). ✅ RANDOM TIMING IS FINE - no optimization needed, users engage consistently.`
    } else {
      recommendation = `Moderate variance (${(variance * 100).toFixed(1)}%). ⏳ MONITOR - collect more data (2-4 weeks) before enabling optimization.`
    }
    
    // Get hourly data
    const hourlyData = overallAnalytics.map(hour => ({
      hour: hour.sendHour,
      emailsSent: hour.emailsSent || 0,
      emailsClicked: hour.emailsClicked || 0,
      clickRate: parseFloat(hour.clickRate || '0'),
      sampleSize: hour.sampleSize || 0,
    }))
    
    // Get demographic performance
    const demographics = await db.select()
      .from(demographicPerformance)
      .where(eq(demographicPerformance.analysisDate, today))
      .orderBy(sql`${demographicPerformance.clickRate} DESC`)
    
    const demographicData = demographics.map(demo => ({
      segment: `${demo.segmentType}: ${demo.segmentValue}`,
      clickRate: parseFloat(demo.clickRate || '0'),
      optimalHour: demo.optimalSendHour || 10,
      sampleSize: demo.emailsSent || 0,
    }))
    
    // Get cohort performance
    const cohorts = await db.select({
      cohortName: sendTimeCohorts.cohortName,
      emailsSent: sendTimeCohorts.emailsSent,
      emailsClicked: sendTimeCohorts.emailsClicked,
      clickRate: sendTimeCohorts.clickRate,
      avgTimeToClick: sendTimeCohorts.avgTimeToClick,
    })
      .from(sendTimeCohorts)
      .where(sql`${sendTimeCohorts.emailsSent} > 0`)
    
    const cohortData = cohorts.map(cohort => ({
      cohort: cohort.cohortName,
      emailsSent: cohort.emailsSent || 0,
      clickRate: parseFloat(cohort.clickRate || '0'),
      avgTimeToClick: cohort.avgTimeToClick || 0,
    }))
    
    return NextResponse.json({
      variance,
      optimizationEnabled,
      recommendation,
      hourlyData,
      demographicData,
      cohortData,
      lastUpdated: new Date().toISOString(),
    })
    
  } catch (error) {
    console.error('[SendTimeAnalytics] Error:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}

/**
 * Calculate variance (coefficient of variation)
 */
function calculateVariance(values: number[]): number {
  if (values.length === 0) return 0
  
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length
  if (mean === 0) return 0
  
  const squaredDiffs = values.map(val => Math.pow(val - mean, 2))
  const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length
  
  return Math.sqrt(variance) / mean // Coefficient of variation
}
