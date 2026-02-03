import { NextResponse } from 'next/server'
import { db } from '@/db'
import { sendTimeAnalytics, demographicPerformance } from '@/db/schema'
import { eq, sql } from 'drizzle-orm'

/**
 * API Route: Get Send-Time Statistics
 * 
 * Returns aggregated statistics for the send-time optimization dashboard
 */
export async function GET() {
  try {
    const today = new Date().toISOString().split('T')[0]
    
    // Get today's analytics
    const analytics = await db.select()
      .from(sendTimeAnalytics)
      .where(eq(sendTimeAnalytics.analysisDate, today))
    
    if (analytics.length === 0) {
      return NextResponse.json({
        variance: 0,
        optimizationEnabled: false,
        recommendation: 'No data yet. Send emails to start collecting data.',
        hourlyStats: [],
        demographicStats: [],
      })
    }
    
    // Calculate overall variance
    const hourlyStats = analytics.map(a => ({
      hour: a.sendHour,
      emailsSent: a.emailsSent || 0,
      emailsClicked: a.emailsClicked || 0,
      clickRate: parseFloat(a.clickRate || '0'),
      avgTimeToClick: a.avgTimeToClick,
    }))
    
    const clickRates = hourlyStats
      .filter(h => h.emailsSent >= 100)
      .map(h => h.clickRate)
    
    const variance = clickRates.length > 0 ? calculateVariance(clickRates) : 0
    const optimizationEnabled = analytics[0]?.optimizationEnabled || false
    
    let recommendation = ''
    if (clickRates.length < 3) {
      recommendation = 'Insufficient data. Need at least 3 hours with 100+ emails each.'
    } else if (variance > 0.30) {
      recommendation = `High variance (${(variance * 100).toFixed(1)}%) detected. ✅ ENABLE OPTIMIZATION - personalized send times will improve engagement.`
    } else if (variance < 0.15) {
      recommendation = `Low variance (${(variance * 100).toFixed(1)}%). ✅ RANDOM TIMING IS FINE - no optimization needed.`
    } else {
      recommendation = `Moderate variance (${(variance * 100).toFixed(1)}%). ⏳ MONITOR - collect more data before optimizing.`
    }
    
    // Get demographic performance
    const demographics = await db.select()
      .from(demographicPerformance)
      .where(eq(demographicPerformance.analysisDate, today))
    
    const demographicStats = demographics.map(d => ({
      segmentType: d.segmentType,
      segmentValue: d.segmentValue,
      emailsSent: d.emailsSent || 0,
      clickRate: parseFloat(d.clickRate || '0'),
      optimalSendHour: d.optimalSendHour,
    }))
    
    return NextResponse.json({
      variance,
      optimizationEnabled,
      recommendation,
      hourlyStats,
      demographicStats,
    })
  } catch (error) {
    console.error('[SendTimeStats] Error:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}

function calculateVariance(values: number[]): number {
  if (values.length === 0) return 0
  
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length
  const squaredDiffs = values.map(val => Math.pow(val - mean, 2))
  const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length
  
  return Math.sqrt(variance) / mean // Coefficient of variation
}
