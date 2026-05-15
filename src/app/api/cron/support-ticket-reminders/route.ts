import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import {
  findOpenTicketsWithoutAdminReply,
  findInProgressTicketsWithoutRecentAdminReply,
} from '@/db/repositories/supportRepository'
import {
  sendTicketReminderDigest,
  type StaleTicketRow,
} from '@/server/supportEmailService'

/**
 * GET/POST /api/cron/support-ticket-reminders
 * Daily 09:00 UTC. Sends a single digest email to the admin inbox
 * summarising tickets that need attention.
 *
 * Logic:
 *   1. `open` tickets > 48h old with no public admin reply
 *   2. `in_progress` tickets where the last public admin reply is > 24h ago
 *
 * Auth: Authorization: Bearer <CRON_SECRET>
 * If CRON_SECRET is unset, the check is skipped (matches the pattern of
 * every other cron in this repo — always set in production).
 */
const FIRST_RESPONSE_THRESHOLD_HOURS = 48
const FOLLOWUP_THRESHOLD_HOURS = 24

async function handle(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startedAt = Date.now()

  try {
    const [stalledOpen, stalledInProgress] = await Promise.all([
      findOpenTicketsWithoutAdminReply(FIRST_RESPONSE_THRESHOLD_HOURS),
      findInProgressTicketsWithoutRecentAdminReply(FOLLOWUP_THRESHOLD_HOURS),
    ])

    const now = Date.now()
    const toRow = (
      t: typeof stalledOpen[number],
      reason: StaleTicketRow['reason']
    ): StaleTicketRow => ({
      ticketNumber: t.ticketNumber,
      ticketId: t.id,
      subject: t.subject,
      userEmail: t.userEmail,
      userRole: t.userRole,
      priority: t.priority,
      ageHours: (now - new Date(t.createdAt).getTime()) / (1000 * 60 * 60),
      reason,
    })

    const needsFirstResponse = stalledOpen.map((t) => toRow(t, 'needs_first_response'))
    const needsFollowup = stalledInProgress.map((t) => toRow(t, 'needs_followup'))
    const total = needsFirstResponse.length + needsFollowup.length

    let emailed = false
    if (total > 0) {
      const result = await sendTicketReminderDigest({
        needsFirstResponse,
        needsFollowup,
      })
      emailed = result.success
    }

    return NextResponse.json({
      ok: true,
      reminded: emailed ? total : 0,
      openCount: needsFirstResponse.length,
      overdueCount: needsFollowup.length,
      durationMs: Date.now() - startedAt,
    })
  } catch (err) {
    console.error('[cron/support-ticket-reminders] error:', err)
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        durationMs: Date.now() - startedAt,
      },
      { status: 500 }
    )
  }
}

export const GET = handle
export const POST = handle
