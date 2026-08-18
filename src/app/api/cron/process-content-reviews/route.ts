/**
 * Process Content Reviews Cron
 * GET/POST /api/cron/process-content-reviews
 *
 * Runs every 2 hours (SLA-sensitive). Handles:
 * 1. 75% SLA → send reminder to brand
 * 2. 90% SLA → send urgent reminder to brand
 * 3. 100% SLA + auto_approve_enabled → auto-approve post
 * 4. 100% SLA + !auto_approve_enabled → escalation notification
 *
 * Duplicate prevention: checks content_review_reminders before creating.
 * Configured in vercel.json: "0 *​/2 * * *"
 */

import { NextRequest, NextResponse } from 'next/server'
import { withCronRun } from '@/lib/cron/withCronRun'
import { processAutoApprovals } from '@/server/contentApprovalService'

function verifyAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET || process.env.AUTH_SECRET
  return authHeader === `Bearer ${cronSecret}`
}

async function handler(request: NextRequest) {
  const startTime = Date.now()
  console.log('[CRON] Starting content review processing...')

  if (!verifyAuth(request)) {
    console.error('[CRON] Unauthorized content review attempt')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const stats = await processAutoApprovals()

    const duration = Date.now() - startTime
    console.log(
      `[CRON] Content review complete in ${duration}ms:`,
      `${stats.autoApproved} auto-approved,`,
      `${stats.reminders75} 75% reminders,`,
      `${stats.reminders90} 90% reminders,`,
      `${stats.escalations} escalations`,
    )

    return NextResponse.json({
      success: true,
      ...stats,
      duration,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[CRON] Fatal error in content review processing:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process content reviews',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}

// Run-recording (migration 037). GET and POST are the same job reached two
// ways, so they share one job_name. ⚠️ Auth lives in `handler` and uses
// CRON_SECRET || AUTH_SECRET — left untouched.
// secretEnv matches this route's inline `handler` auth
// (CRON_SECRET || AUTH_SECRET) so the wrapper accepts exactly what it does.
const contentReviewAuth = { secretEnv: ['CRON_SECRET', 'AUTH_SECRET'] }
export const GET = withCronRun('process-content-reviews', handler, contentReviewAuth)
export const POST = withCronRun('process-content-reviews', handler, contentReviewAuth)
