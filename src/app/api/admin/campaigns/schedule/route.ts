import { NextRequest, NextResponse } from 'next/server'
import { notifyNewSurvey } from '@/server/campaigns/surveyNotificationCampaign'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    const {
      surveyId,
      scheduleType,
      scheduledFor,
      categoryFilter,
      demographicFilters,
      behavioralFilters,
      sendTimeOptimization
    } = body

    if (!surveyId) {
      return NextResponse.json(
        { error: 'Survey ID is required' },
        { status: 400 }
      )
    }

    // Build options object
    const options: any = {
      sendTimeOptimization: sendTimeOptimization !== false
    }

    // Add filters if provided
    if (categoryFilter) {
      options.categoryFilter = categoryFilter
    }

    if (demographicFilters) {
      options.demographicFilters = demographicFilters
    }

    if (behavioralFilters) {
      options.behavioralFilters = behavioralFilters
    }

    // Call campaign function
    const result = await notifyNewSurvey(surveyId, options)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Campaign failed' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      notificationsSent: result.notificationsSent,
      message: result.message,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('[Campaign API] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
