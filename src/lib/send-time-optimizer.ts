/**
 * Send-Time Optimization System
 * 
 * Implements intelligent email send-time optimization based on:
 * 1. Click-rate tracking by hour of day
 * 2. Demographic segment analysis
 * 3. A/B testing with cohorts
 * 4. Automatic optimization when variance >30%
 * 
 * Decision Logic:
 * - If click-rate variance >30%: Enable optimization (personalized send times)
 * - If click-rate variance <15%: Keep random timing (no optimization needed)
 * - Between 15-30%: Monitor and collect more data
 */

import { db } from '@/db'
import { 
  emailSendEvents, 
  sendTimeCohorts, 
  sendTimeAnalytics, 
  demographicPerformance,
  userProfiles 
} from '@/db/schema'
import { eq, sql, and, gte, lte } from 'drizzle-orm'
import { checkConsent } from '@/lib/consent-enforcement'

// Cohort definitions for A/B testing
export const SEND_TIME_COHORTS = {
  morning: { name: 'morning', hourMin: 8, hourMax: 11, label: 'Morning (8am-11am)' },
  lunch: { name: 'lunch', hourMin: 12, hourMax: 13, label: 'Lunch (12pm-1pm)' },
  afternoon: { name: 'afternoon', hourMin: 14, hourMax: 16, label: 'Afternoon (2pm-4pm)' },
  evening: { name: 'evening', hourMin: 18, hourMax: 20, label: 'Evening (6pm-8pm)' },
  night: { name: 'night', hourMin: 21, hourMax: 23, label: 'Night (9pm-11pm)' },
  control: { name: 'control', hourMin: 0, hourMax: 23, label: 'Control (Random)' },
} as const

// Variance thresholds
const OPTIMIZATION_THRESHOLD = 0.30 // 30% variance → enable optimization
const RANDOM_OK_THRESHOLD = 0.15 // 15% variance → random timing is fine
const MIN_SAMPLE_SIZE = 100 // Minimum emails per hour for statistical significance

/**
 * Assign user to a send-time cohort (for A/B testing)
 */
export async function assignUserToCohort(userId: string): Promise<string> {
  try {
    // Check if already assigned
    const existing = await db.select()
      .from(sendTimeCohorts)
      .where(eq(sendTimeCohorts.userId, userId))
      .limit(1)
    
    if (existing.length > 0) {
      return existing[0].cohortName
    }
    
    // Assign to cohort based on user ID hash (deterministic distribution)
    const cohortNames = Object.keys(SEND_TIME_COHORTS)
    const hash = hashString(userId)
    const cohortIndex = hash % cohortNames.length
    const cohortName = cohortNames[cohortIndex]
    const cohort = SEND_TIME_COHORTS[cohortName as keyof typeof SEND_TIME_COHORTS]
    
    await db.insert(sendTimeCohorts).values({
      userId,
      cohortName: cohort.name,
      sendHourMin: cohort.hourMin,
      sendHourMax: cohort.hourMax,
    })
    
    console.log(`[SendTimeOptimizer] Assigned user ${userId} to cohort: ${cohortName}`)
    return cohort.name
  } catch (error) {
    console.error('[SendTimeOptimizer] Error assigning cohort:', error)
    return 'control' // Default to control group
  }
}

/**
 * Get optimal send hour for a user based on their demographics and cohort
 */
export async function getOptimalSendHour(userId: string): Promise<number> {
  try {
    // Get user profile for demographics
    const profile = await db.select()
      .from(userProfiles)
      .where(eq(userProfiles.id, userId))
      .limit(1)
    
    if (!profile.length) {
      return getRandomHourInRange(8, 20) // Default to business hours
    }
    
    // Check if optimization is enabled (based on variance analysis)
    const shouldOptimize = await isOptimizationEnabled()
    
    if (!shouldOptimize) {
      // Variance <15% or insufficient data → use random timing
      return getRandomHourInRange(8, 20)
    }
    
    // Get user's cohort
    const cohort = await assignUserToCohort(userId)
    const cohortConfig = SEND_TIME_COHORTS[cohort as keyof typeof SEND_TIME_COHORTS]
    
    if (cohort === 'control') {
      // Control group always gets random timing
      return getRandomHourInRange(8, 20)
    }
    
    // Try demographic-based optimization first
    const demographics = profile[0].demographics as any
    if (demographics?.industry) {
      const optimalHour = await getOptimalHourForDemographic('industry', demographics.industry)
      if (optimalHour !== null) {
        // Use demographic optimal hour if within cohort range
        if (optimalHour >= cohortConfig.hourMin && optimalHour <= cohortConfig.hourMax) {
          return optimalHour
        }
      }
    }
    
    // Fall back to cohort-specific random hour
    return getRandomHourInRange(cohortConfig.hourMin, cohortConfig.hourMax)
  } catch (error) {
    console.error('[SendTimeOptimizer] Error getting optimal send hour:', error)
    return getRandomHourInRange(8, 20)
  }
}

/**
 * Check if send-time optimization is enabled based on variance analysis
 */
export async function isOptimizationEnabled(): Promise<boolean> {
  try {
    const today = new Date().toISOString().split('T')[0]
    
    // Get today's analytics
    const analytics = await db.select()
      .from(sendTimeAnalytics)
      .where(eq(sendTimeAnalytics.analysisDate, today))
      .limit(1)
    
    if (!analytics.length) {
      return false // Not enough data yet
    }
    
    return analytics[0].optimizationEnabled || false
  } catch (error) {
    console.error('[SendTimeOptimizer] Error checking optimization status:', error)
    return false
  }
}

/**
 * Get optimal send hour for a demographic segment
 */
async function getOptimalHourForDemographic(
  segmentType: string, 
  segmentValue: string
): Promise<number | null> {
  try {
    const today = new Date().toISOString().split('T')[0]
    
    const result = await db.select()
      .from(demographicPerformance)
      .where(
        and(
          eq(demographicPerformance.analysisDate, today),
          eq(demographicPerformance.segmentType, segmentType),
          eq(demographicPerformance.segmentValue, segmentValue)
        )
      )
      .limit(1)
    
    if (result.length > 0 && result[0].optimalSendHour !== null) {
      return result[0].optimalSendHour
    }
    
    return null
  } catch (error) {
    console.error('[SendTimeOptimizer] Error getting demographic optimal hour:', error)
    return null
  }
}

/**
 * Track email send event
 * REQUIRES: analytics consent for demographic tracking
 */
export async function trackEmailSend(params: {
  userId: string
  notificationId?: string
  emailType: string
  sentAt: Date
  userAgeBracket?: string
  userIncomeBracket?: string
  userIndustry?: string
}): Promise<string> {
  try {
    // ✅ CONSENT CHECK: Require analytics consent for demographic tracking
    const analyticsConsent = await checkConsent(params.userId, 'analytics')
    
    let userAgeBracket = params.userAgeBracket
    let userIncomeBracket = params.userIncomeBracket
    let userIndustry = params.userIndustry
    
    // Only include demographics if user consented to analytics
    if (!analyticsConsent.allowed) {
      console.log(`[SendTimeOptimizer] User ${params.userId} hasn't consented to analytics - tracking without demographics`)
      userAgeBracket = undefined
      userIncomeBracket = undefined
      userIndustry = undefined
    }
    
    const sendHour = params.sentAt.getHours()
    const sendDayOfWeek = params.sentAt.getDay()
    
    const result = await db.insert(emailSendEvents).values({
      userId: params.userId,
      notificationId: params.notificationId as any,
      emailType: params.emailType,
      sentAt: params.sentAt,
      sendHour,
      sendDayOfWeek,
      userAgeBracket,
      userIncomeBracket,
      userIndustry,
    }).returning()
    
    console.log(`[SendTimeOptimizer] Tracked email send for user ${params.userId} at hour ${sendHour}`)
    return result[0].id
  } catch (error) {
    console.error('[SendTimeOptimizer] Error tracking email send:', error)
    throw error
  }
}

/**
 * Track email click event
 */
export async function trackEmailClick(eventId: string): Promise<void> {
  try {
    const clickedAt = new Date()
    
    // Get the send event
    const sendEvent = await db.select()
      .from(emailSendEvents)
      .where(eq(emailSendEvents.id, eventId))
      .limit(1)
    
    if (!sendEvent.length) {
      console.error('[SendTimeOptimizer] Send event not found:', eventId)
      return
    }
    
    const timeToClick = Math.floor(
      (clickedAt.getTime() - sendEvent[0].sentAt.getTime()) / 1000 / 60
    )
    
    await db.update(emailSendEvents)
      .set({
        clicked: true,
        clickedAt,
        timeToClick,
      })
      .where(eq(emailSendEvents.id, eventId))
    
    console.log(`[SendTimeOptimizer] Tracked email click: ${eventId} (${timeToClick} minutes)`)
  } catch (error) {
    console.error('[SendTimeOptimizer] Error tracking email click:', error)
  }
}

/**
 * Analyze send-time performance and update analytics
 * Run this daily as a cron job
 */
export async function analyzeSendTimePerformance(): Promise<{
  variance: number
  optimizationEnabled: boolean
  recommendation: string
}> {
  try {
    const today = new Date()
    const analysisDate = today.toISOString().split('T')[0]
    
    console.log('[SendTimeOptimizer] Starting daily send-time analysis...')
    
    // Calculate metrics for each hour
    const hourlyMetrics = []
    for (let hour = 0; hour < 24; hour++) {
      const metrics = await calculateHourlyMetrics(hour, today)
      hourlyMetrics.push(metrics)
      
      // Update or insert analytics
      await db.insert(sendTimeAnalytics)
        .values({
          analysisDate,
          sendHour: hour,
          ...metrics,
        })
        .onConflictDoUpdate({
          target: [sendTimeAnalytics.analysisDate, sendTimeAnalytics.sendHour],
          set: {
            ...metrics,
            updatedAt: new Date(),
          },
        })
    }
    
    // Calculate variance in click rates
    const clickRates = hourlyMetrics
      .filter(m => m.sampleSize >= MIN_SAMPLE_SIZE)
      .map(m => parseFloat(m.clickRate || '0'))
    
    const variance = calculateVariance(clickRates)
    
    // Determine if optimization should be enabled
    let optimizationEnabled = false
    let recommendation = ''
    
    if (clickRates.length < 3) {
      recommendation = 'Insufficient data. Need at least 3 hours with 100+ emails each.'
    } else if (variance > OPTIMIZATION_THRESHOLD) {
      optimizationEnabled = true
      recommendation = `High variance (${(variance * 100).toFixed(1)}%) detected. ✅ ENABLE OPTIMIZATION - personalized send times will improve engagement.`
    } else if (variance < RANDOM_OK_THRESHOLD) {
      optimizationEnabled = false
      recommendation = `Low variance (${(variance * 100).toFixed(1)}%). ✅ RANDOM TIMING IS FINE - no optimization needed.`
    } else {
      optimizationEnabled = false
      recommendation = `Moderate variance (${(variance * 100).toFixed(1)}%). ⏳ MONITOR - collect more data before optimizing.`
    }
    
    // Update optimization flag for today
    await db.update(sendTimeAnalytics)
      .set({ 
        optimizationEnabled, 
        variance: variance.toString() 
      })
      .where(eq(sendTimeAnalytics.analysisDate, analysisDate))
    
    console.log(`[SendTimeOptimizer] Analysis complete:`, {
      variance: (variance * 100).toFixed(1) + '%',
      optimizationEnabled,
      recommendation,
    })
    
    return { variance, optimizationEnabled, recommendation }
  } catch (error) {
    console.error('[SendTimeOptimizer] Error analyzing send-time performance:', error)
    throw error
  }
}

/**
 * Analyze demographic segments and find optimal send times
 */
export async function analyzeDemographicSegments(): Promise<void> {
  try {
    const today = new Date()
    const analysisDate = today.toISOString().split('T')[0]
    
    console.log('[SendTimeOptimizer] Analyzing demographic segments...')
    
    // Analyze by industry
    const industries = await db.selectDistinct({
      industry: emailSendEvents.userIndustry
    })
      .from(emailSendEvents)
      .where(sql`${emailSendEvents.userIndustry} IS NOT NULL`)
    
    for (const { industry } of industries) {
      if (!industry) continue
      
      const metrics = await analyzeDemographicSegment('industry', industry)
      
      await db.insert(demographicPerformance)
        .values({
          analysisDate,
          segmentType: 'industry',
          segmentValue: industry,
          ...metrics,
        })
        .onConflictDoUpdate({
          target: [
            demographicPerformance.analysisDate,
            demographicPerformance.segmentType,
            demographicPerformance.segmentValue,
          ],
          set: {
            ...metrics,
            updatedAt: new Date(),
          },
        })
    }
    
    console.log('[SendTimeOptimizer] Demographic analysis complete')
  } catch (error) {
    console.error('[SendTimeOptimizer] Error analyzing demographics:', error)
  }
}

/**
 * Calculate metrics for a specific hour
 */
async function calculateHourlyMetrics(hour: number, date: Date) {
  const startDate = new Date(date)
  startDate.setDate(startDate.getDate() - 30) // Last 30 days
  
  const result = await db.select({
    emailsSent: sql<number>`COUNT(*)`,
    emailsClicked: sql<number>`SUM(CASE WHEN ${emailSendEvents.clicked} THEN 1 ELSE 0 END)`,
    avgTimeToClick: sql<number>`AVG(${emailSendEvents.timeToClick})`,
  })
    .from(emailSendEvents)
    .where(
      and(
        eq(emailSendEvents.sendHour, hour),
        gte(emailSendEvents.sentAt, startDate)
      )
    )
  
  const emailsSent = Number(result[0]?.emailsSent || 0)
  const emailsClicked = Number(result[0]?.emailsClicked || 0)
  const clickRate = emailsSent > 0 ? emailsClicked / emailsSent : 0
  
  return {
    emailsSent,
    emailsClicked,
    clickRate: clickRate.toFixed(4),
    avgTimeToClick: result[0]?.avgTimeToClick || null,
    sampleSize: emailsSent,
  }
}

/**
 * Analyze a specific demographic segment
 */
async function analyzeDemographicSegment(segmentType: string, segmentValue: string) {
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - 30)
  
  // Get overall metrics for this segment
  const overall = await db.select({
    emailsSent: sql<number>`COUNT(*)`,
    emailsClicked: sql<number>`SUM(CASE WHEN ${emailSendEvents.clicked} THEN 1 ELSE 0 END)`,
    avgTimeToClick: sql<number>`AVG(${emailSendEvents.timeToClick})`,
  })
    .from(emailSendEvents)
    .where(
      and(
        segmentType === 'industry' 
          ? eq(emailSendEvents.userIndustry, segmentValue)
          : sql`1=0`,
        gte(emailSendEvents.sentAt, startDate)
      )
    )
  
  // Find optimal send hour
  const hourlyPerformance = await db.select({
    sendHour: emailSendEvents.sendHour,
    clicks: sql<number>`SUM(CASE WHEN ${emailSendEvents.clicked} THEN 1 ELSE 0 END)`,
    sends: sql<number>`COUNT(*)`,
  })
    .from(emailSendEvents)
    .where(
      and(
        segmentType === 'industry'
          ? eq(emailSendEvents.userIndustry, segmentValue)
          : sql`1=0`,
        gte(emailSendEvents.sentAt, startDate)
      )
    )
    .groupBy(emailSendEvents.sendHour)
  
  let optimalHour = null
  let optimalClickRate = 0
  
  for (const hourData of hourlyPerformance) {
    const sends = Number(hourData.sends)
    const clicks = Number(hourData.clicks)
    if (sends >= 20) { // Minimum sample size per hour
      const clickRate = clicks / sends
      if (clickRate > optimalClickRate) {
        optimalClickRate = clickRate
        optimalHour = hourData.sendHour
      }
    }
  }
  
  const emailsSent = Number(overall[0]?.emailsSent || 0)
  const emailsClicked = Number(overall[0]?.emailsClicked || 0)
  const clickRate = emailsSent > 0 ? emailsClicked / emailsSent : 0
  
  return {
    emailsSent,
    emailsClicked,
    clickRate: clickRate.toFixed(4),
    avgTimeToClick: overall[0]?.avgTimeToClick || null,
    optimalSendHour: optimalHour,
    optimalHourClickRate: optimalClickRate > 0 ? optimalClickRate.toFixed(4) : null,
  }
}

/**
 * Calculate variance of an array of numbers
 */
function calculateVariance(values: number[]): number {
  if (values.length === 0) return 0
  
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length
  const squaredDiffs = values.map(val => Math.pow(val - mean, 2))
  const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length
  
  return Math.sqrt(variance) / mean // Coefficient of variation
}

/**
 * Get random hour within a range
 */
function getRandomHourInRange(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

/**
 * Simple string hash function for deterministic cohort assignment
 */
function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return Math.abs(hash)
}
