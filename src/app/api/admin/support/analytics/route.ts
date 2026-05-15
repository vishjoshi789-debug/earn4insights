import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { supportAdminRateLimit } from '@/lib/rate-limit-upstash'
import { db, pgClient } from '@/db'
import { supportTickets } from '@/db/schema'
import { sql, and, gte, isNotNull } from 'drizzle-orm'
import { getAiResolutionRate } from '@/server/chatbotService'
import {
  countEventsInWindow,
  countTicketsBy,
  resolutionTimeBuckets,
  satisfactionDistribution,
  findRecentEscalations,
} from '@/db/repositories/supportRepository'

/**
 * GET /api/admin/support/analytics?days=30
 * Returns aggregate metrics for the admin support dashboard.
 *
 *   - openByStatus           {open, in_progress, waiting_on_user, resolved, closed}
 *   - avgFirstResponseHours  null when no resolved ticket has a non-user first reply
 *   - avgResolutionHours     average wall-clock time from created → resolved
 *   - aiResolutionRate       chat_resolved_by_ai / chat_started (last N days)
 *   - satisfactionAvg        avg ticket rating (1..5) over window; null if no ratings
 *   - faqViewsLastN          total FAQ views in window
 *   - escalationsLastN       chats that promoted to tickets in window
 *   - ticketsOverTime        [{ day: 'YYYY-MM-DD', count }] for the window
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = (session.user as any).id as string
    const role = (session.user as any).role as string
    if (role !== 'admin') return NextResponse.json({ error: 'Admin access only' }, { status: 403 })

    const rl = await supportAdminRateLimit.limit(userId)
    if (!rl.success) {
      return NextResponse.json({ error: 'Too many requests.' }, { status: 429 })
    }

    const days = Math.min(365, Math.max(1, parseInt(req.nextUrl.searchParams.get('days') || '30')))
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

    // Counts by status (always-on, no window — gives the current queue picture)
    const statusRows = await db
      .select({ status: supportTickets.status, count: sql<number>`count(*)::int` })
      .from(supportTickets)
      .groupBy(supportTickets.status)
    const openByStatus: Record<string, number> = {}
    for (const r of statusRows) openByStatus[r.status] = r.count

    // Avg resolution time (in window)
    const [resolutionRow] = await db
      .select({
        avgMs: sql<number | null>`AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) * 1000)`,
      })
      .from(supportTickets)
      .where(and(isNotNull(supportTickets.resolvedAt), gte(supportTickets.createdAt, since)))
    const avgResolutionHours =
      resolutionRow?.avgMs != null ? Number(resolutionRow.avgMs) / (1000 * 60 * 60) : null

    // Avg first-response time = time from ticket creation to the FIRST
    // admin/ai message on that ticket. Uses a correlated subquery on messages.
    const firstResponseRows = await pgClient<{ avg_ms: string | null }[]>`
      SELECT AVG(EXTRACT(EPOCH FROM (fr.first_admin_at - t.created_at)) * 1000)::text AS avg_ms
      FROM support_tickets t
      JOIN LATERAL (
        SELECT MIN(m.created_at) AS first_admin_at
        FROM support_ticket_messages m
        WHERE m.ticket_id = t.id
          AND m.sender_type IN ('admin', 'ai')
          AND m.is_internal_note = false
      ) fr ON fr.first_admin_at IS NOT NULL
      WHERE t.created_at >= ${since}
    `
    const avgFirstResponseHours =
      firstResponseRows[0]?.avg_ms != null && firstResponseRows[0].avg_ms !== ''
        ? Number(firstResponseRows[0].avg_ms) / (1000 * 60 * 60)
        : null

    // Avg satisfaction (in window)
    const [satisfactionRow] = await db
      .select({ avg: sql<number | null>`AVG(satisfaction_rating)` })
      .from(supportTickets)
      .where(and(isNotNull(supportTickets.satisfactionRating), gte(supportTickets.createdAt, since)))
    const satisfactionAvg = satisfactionRow?.avg != null ? Number(satisfactionRow.avg) : null

    // AI resolution rate (chatbot)
    const aiResolutionRate = await getAiResolutionRate(days)

    // FAQ views + chat escalations + breakdowns + recent escalation list
    const [
      faqViewsLastN,
      escalationsLastN,
      byCategory,
      byPriority,
      byRole,
      resolutionBuckets,
      satisfactionDist,
      recentEscalations,
    ] = await Promise.all([
      countEventsInWindow('faq_viewed', since),
      countEventsInWindow('chat_escalated', since),
      countTicketsBy('category', since),
      countTicketsBy('priority', since),
      countTicketsBy('user_role', since),
      resolutionTimeBuckets(since),
      satisfactionDistribution(since),
      findRecentEscalations(10),
    ])

    // Tickets over time (one row per day, includes zero days)
    const timeSeries = await pgClient<{ day: string; count: string }[]>`
      SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
             COUNT(*)::text AS count
      FROM support_tickets
      WHERE created_at >= ${since}
      GROUP BY 1
      ORDER BY 1 ASC
    `
    const ticketsOverTime = timeSeries.map((r) => ({ day: r.day, count: Number(r.count) }))

    return NextResponse.json({
      windowDays: days,
      openByStatus,
      avgFirstResponseHours,
      avgResolutionHours,
      satisfactionAvg,
      aiResolutionRate,
      faqViewsLastN,
      escalationsLastN,
      ticketsOverTime,
      byCategory,
      byPriority,
      byRole,
      resolutionBuckets,
      satisfactionDistribution: satisfactionDist,
      recentEscalations,
    })
  } catch (err) {
    console.error('[admin/support/analytics GET] error:', err)
    return NextResponse.json({ error: 'Failed to load analytics' }, { status: 500 })
  }
}
