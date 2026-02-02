import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { userProfiles, users, userEvents, surveyResponses, feedback, notificationQueue } from '@/db/schema'
import { eq, and, lt, sql } from 'drizzle-orm'

// Verify the request is from Vercel Cron or authorized
function verifyAuth(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET || process.env.AUTH_SECRET
  
  if (authHeader === `Bearer ${cronSecret}`) {
    return true
  }
  
  return false
}

/**
 * Process Permanent Account Deletions
 * 
 * This endpoint runs daily to permanently delete accounts where:
 * 1. User requested deletion
 * 2. 30-day grace period has expired
 * 3. User hasn't cancelled the deletion request
 * 
 * Configured in vercel.json to run daily at 2 AM UTC
 */
export async function GET(request: NextRequest) {
  return processAccountDeletions(request)
}

export async function POST(request: NextRequest) {
  return processAccountDeletions(request)
}

async function processAccountDeletions(request: NextRequest) {
  const startTime = Date.now()
  console.log('[CRON] Starting permanent account deletion process...')

  // Verify authorization
  if (!verifyAuth(request)) {
    console.error('[CRON] Unauthorized deletion attempt')
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    // Find all profiles with expired deletion grace periods
    const now = new Date()
    const profilesToDelete = await db
      .select()
      .from(userProfiles)
      .where(
        and(
          sql`${userProfiles.consent}->>'deletionRequested' = 'true'`,
          sql`TO_TIMESTAMP(${userProfiles.consent}->>'deletionScheduledFor', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') <= ${now}`
        )
      )

    console.log(`[CRON] Found ${profilesToDelete.length} accounts to delete`)

    if (profilesToDelete.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No accounts ready for deletion',
        deletedCount: 0,
        duration: Date.now() - startTime
      })
    }

    const deletedAccounts = []

    // Delete each account's data
    for (const profile of profilesToDelete) {
      try {
        console.log(`[CRON] Deleting account: ${profile.id}`)

        // Get user email for comprehensive deletion
        const user = await db.query.users.findFirst({
          where: eq(users.id, profile.id)
        })

        if (!user) {
          console.warn(`[CRON] User not found for profile ${profile.id}`)
          continue
        }

        // Delete in reverse order of dependencies
        // 1. Delete notification queue
        await db.delete(notificationQueue).where(eq(notificationQueue.userId, profile.id))
        console.log(`[CRON]   ✓ Deleted notifications`)

        // 2. Delete feedback
        await db.delete(feedback).where(eq(feedback.userEmail, user.email!))
        console.log(`[CRON]   ✓ Deleted feedback`)

        // 3. Delete survey responses
        await db.delete(surveyResponses).where(eq(surveyResponses.userEmail, user.email!))
        console.log(`[CRON]   ✓ Deleted survey responses`)

        // 4. Delete user events
        await db.delete(userEvents).where(eq(userEvents.userId, profile.id))
        console.log(`[CRON]   ✓ Deleted user events`)

        // 5. Delete user profile
        await db.delete(userProfiles).where(eq(userProfiles.id, profile.id))
        console.log(`[CRON]   ✓ Deleted user profile`)

        // 6. Delete user account (this cascades sessions, accounts, etc via NextAuth)
        await db.delete(users).where(eq(users.id, profile.id))
        console.log(`[CRON]   ✓ Deleted user account`)

        deletedAccounts.push({
          userId: profile.id,
          userEmail: user.email,
          deletionRequestedAt: (profile.consent as any)?.deletionRequestedAt,
          deletionScheduledFor: (profile.consent as any)?.deletionScheduledFor,
          deletedAt: now.toISOString()
        })

        console.log(`[CRON] ✓ Successfully deleted account ${profile.id}`)

      } catch (error) {
        console.error(`[CRON] Error deleting account ${profile.id}:`, error)
        // Continue with other accounts even if one fails
      }
    }

    const duration = Date.now() - startTime

    console.log(`[CRON] Deletion process complete. Deleted ${deletedAccounts.length} accounts in ${duration}ms`)

    return NextResponse.json({
      success: true,
      message: `Permanently deleted ${deletedAccounts.length} accounts`,
      deletedCount: deletedAccounts.length,
      deletedAccounts: deletedAccounts.map(acc => ({
        userId: acc.userId,
        deletedAt: acc.deletedAt
      })),
      duration,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('[CRON] Fatal error in deletion process:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process account deletions',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
