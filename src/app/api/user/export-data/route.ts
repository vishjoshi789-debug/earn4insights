import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { db } from '@/db'
import { userProfiles, userEvents, surveyResponses, feedback, notificationQueue } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { logDataExport } from '@/lib/audit-log'

/**
 * GDPR Data Export Endpoint
 * 
 * Allows users to download all their personal data in JSON format
 * Required by GDPR Article 20 (Right to Data Portability)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const userId = session.user.id
    console.log(`[GDPR Export] Starting data export for user ${userId}`)

    // Log data export for audit trail (GDPR compliance)
    await logDataExport(
      userId,
      request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      request.headers.get('user-agent') || undefined
    )

    // Fetch user profile
    const profile = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.id, userId))
      .limit(1)

    // Fetch user events
    const events = await db
      .select()
      .from(userEvents)
      .where(eq(userEvents.userId, userId))

    // Fetch survey responses
    const responses = await db
      .select()
      .from(surveyResponses)
      .where(eq(surveyResponses.userEmail, session.user.email!))

    // Fetch feedback
    const userFeedback = await db
      .select()
      .from(feedback)
      .where(eq(feedback.userEmail, session.user.email!))

    // Fetch notifications
    const notifications = await db
      .select()
      .from(notificationQueue)
      .where(eq(notificationQueue.userId, userId))

    // Compile all data
    const exportData = {
      exportedAt: new Date().toISOString(),
      exportedBy: userId,
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        role: session.user.role,
      },
      profile: profile[0] || null,
      activityData: {
        events: events,
        totalEvents: events.length,
        eventTypes: [...new Set(events.map(e => e.eventType))]
      },
      surveyData: {
        responses: responses,
        totalResponses: responses.length
      },
      feedbackData: {
        feedback: userFeedback,
        totalFeedback: userFeedback.length
      },
      notificationData: {
        notifications: notifications,
        totalNotifications: notifications.length
      },
      metadata: {
        dataCategories: [
          'User Profile',
          'Demographics',
          'Interests',
          'Behavioral Data',
          'Activity Events',
          'Survey Responses',
          'Feedback',
          'Notifications',
          'Consent Records'
        ],
        gdprCompliance: {
          rightToAccess: 'fulfilled',
          rightToDataPortability: 'fulfilled',
          exportFormat: 'JSON',
          containsAllPersonalData: true
        }
      }
    }

    console.log(`[GDPR Export] Export completed for user ${userId}`)

    // Return as downloadable JSON
    return new NextResponse(JSON.stringify(exportData, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="earn4insights-data-export-${userId}-${Date.now()}.json"`
      }
    })

  } catch (error) {
    console.error('[GDPR Export] Error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to export data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
