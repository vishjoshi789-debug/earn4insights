import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { userProfiles, users, surveyResponses, feedback, icpMatchScores } from '@/db/schema'
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
          sql`TO_TIMESTAMP(${userProfiles.consent}->>'deletionScheduledFor', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') <= ${now.toISOString()}`
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

        const user = await db.query.users.findFirst({
          where: eq(users.id, profile.id)
        })

        // Orphaned profile (no user row) — remove the profile directly and move on.
        if (!user) {
          console.warn(`[CRON] User not found for profile ${profile.id} — removing orphaned profile`)
          await db.delete(userProfiles).where(eq(userProfiles.id, profile.id))
          continue
        }

        // ── Tables NOT reachable by a users(id) FK — must delete manually ──
        // feedback / survey_responses are keyed by userEmail (no user_id FK).
        if (user.email) {
          await db.delete(feedback).where(eq(feedback.userEmail, user.email))
          await db.delete(surveyResponses).where(eq(surveyResponses.userEmail, user.email))
          console.log(`[CRON]   ✓ Deleted email-keyed feedback + survey responses`)
        }
        // icp_match_scores is a denormalised cache (consumerId, intentionally FK-less).
        await db.delete(icpMatchScores).where(eq(icpMatchScores.consumerId, profile.id))
        console.log(`[CRON]   ✓ Deleted ICP match score cache`)

        // ── Single delete drives the rest via FK on-delete actions (migration 031) ──
        //   CASCADE  → user_profiles + all PII/operational children (closes the orphan gap)
        //   SET NULL → money history (point_transactions / payout_requests / reward_redemptions)
        //              + analytics (user_events / email_send_events / analytics_events / support_analytics)
        //              → rows retained, user link severed (anonymised erasure)
        //   audit_log is FK-less and intentionally retained (deletion audit trail survives).
        await db.delete(users).where(eq(users.id, profile.id))
        console.log(`[CRON]   ✓ Deleted user account (FK actions cascaded / anonymised dependents)`)

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
