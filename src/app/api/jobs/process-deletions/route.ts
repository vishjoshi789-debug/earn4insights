import { NextRequest, NextResponse } from 'next/server'
import { withCronRun } from '@/lib/cron/withCronRun'
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
// Run-recording (migration 037). GET and POST are the same job reached two
// ways, so they share one job_name.
//
// ⚠️ THE MOST DEVIANT ROUTE OF THE 33 — flagged deliberately. `verifyAuth`
// above uses `CRON_SECRET || AUTH_SECRET` and compares unconditionally, so
// unlike the majority it does NOT fall open when CRON_SECRET is unset (it
// falls back to AUTH_SECRET, and failing that compares against the literal
// "Bearer undefined"). That check is left entirely inside
// `processAccountDeletions` — the wrapper adds recording and nothing else.
//
// This is also the job that permanently deletes user accounts, which is
// exactly the kind of thing that should never have been running unobserved.
export const GET = withCronRun('jobs/process-deletions', processAccountDeletions)
export const POST = withCronRun('jobs/process-deletions', processAccountDeletions)

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

        // ── Feedback: SCRUB the PII, retain the anonymised row ────────────
        // Previously this hard-DELETEd every feedback row matching the user's
        // email. Two problems:
        //
        //   1. It destroyed analytics a brand paid to collect, on one
        //      consumer's erasure — the same reason migration 033 chose
        //      ON DELETE SET NULL over 031's PII→CASCADE rule.
        //   2. `user_email` on IMPORTED rows historically held the importing
        //      BRAND's address (api/import/csv fell back to session.user.email
        //      when a CSV had no email column). So deleting that brand deleted
        //      third-party feedback that merely inherited their address — in
        //      production that was 18 rows.
        //
        // Scrubbing is safe in both cases: it removes the PII (which is what
        // erasure requires) without destroying content that isn't the erased
        // user's to delete. Where the email was wrong, it removes a wrong
        // email — strictly an improvement.
        //
        // `user_id` is NOT set here: migration 033's FK does it automatically
        // via ON DELETE SET NULL when the users row is deleted below. Doing it
        // by hand would also break if this deploys before 033 has run.
        //
        // ⚠️ This scrub is the OTHER HALF of erasure. The FK only severs the
        // account link; without nulling these columns the consumer's name and
        // email remain on the row in plain text and SET NULL is theatre.
        if (user.email) {
          await db
            .update(feedback)
            .set({ userName: null, userEmail: null })
            .where(eq(feedback.userEmail, user.email))
          console.log(`[CRON]   ✓ Scrubbed name/email from feedback (rows retained, anonymised)`)

          // survey_responses keeps the existing hard-delete for now: unlike
          // feedback it has no import path, and 66 of 69 production rows carry
          // no email at all. Revisit if it ever gains an ingestion route.
          await db.delete(surveyResponses).where(eq(surveyResponses.userEmail, user.email))
          console.log(`[CRON]   ✓ Deleted email-keyed survey responses`)
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
