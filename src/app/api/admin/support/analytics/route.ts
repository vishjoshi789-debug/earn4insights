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
 *
 * Each sub-query is wrapped so a single failure cannot poison the whole
 * response — the dashboard still renders the parts that succeeded. The
 * `_errors` field in the response body lists any sub-queries that
 * failed, with the JS error message for diagnosis.
 */

async function safely<T>(label: string, run: () => Promise<T>, fallback: T, errors: string[]): Promise<T> {
  try {
    return await run()
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    errors.push(`${label}: ${msg}`)
    console.error(`[admin/support/analytics] ${label} failed:`, err)
    return fallback
  }
}

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
    const errors: string[] = []

    // ── Counts by status — always-on, no window
    const openByStatus = await safely(
      'openByStatus',
      async () => {
        const rows = await db
          .select({ status: supportTickets.status, count: sql<number>`count(*)::int` })
          .from(supportTickets)
          .groupBy(supportTickets.status)
        const m: Record<string, number> = {}
        for (const r of rows) m[r.status] = r.count
        return m
      },
      {} as Record<string, number>,
      errors,
    )

    // ── Avg resolution time
    const avgResolutionHours = await safely(
      'avgResolutionHours',
      async () => {
        const [r] = await db
          .select({ avgMs: sql<number | null>`AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) * 1000)` })
          .from(supportTickets)
          .where(and(isNotNull(supportTickets.resolvedAt), gte(supportTickets.createdAt, since)))
        return r?.avgMs != null ? Number(r.avgMs) / (1000 * 60 * 60) : null
      },
      null as number | null,
      errors,
    )

    // ── Avg first-response time (LATERAL JOIN on messages)
    const avgFirstResponseHours = await safely(
      'avgFirstResponseHours',
      async () => {
        const rows = await pgClient<{ avg_ms: string | null }[]>`
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
        return rows[0]?.avg_ms != null && rows[0].avg_ms !== ''
          ? Number(rows[0].avg_ms) / (1000 * 60 * 60)
          : null
      },
      null as number | null,
      errors,
    )

    // ── Avg satisfaction
    const satisfactionAvg = await safely(
      'satisfactionAvg',
      async () => {
        const [r] = await db
          .select({ avg: sql<number | null>`AVG(satisfaction_rating)` })
          .from(supportTickets)
          .where(and(isNotNull(supportTickets.satisfactionRating), gte(supportTickets.createdAt, since)))
        return r?.avg != null ? Number(r.avg) : null
      },
      null as number | null,
      errors,
    )

    // ── AI resolution rate (chatbot)
    const aiResolutionRate = await safely(
      'aiResolutionRate',
      () => getAiResolutionRate(days),
      { started: 0, resolvedByAi: 0, rate: 0 },
      errors,
    )

    // ── FAQ views + chat escalations
    const faqViewsLastN = await safely('faqViewsLastN', () => countEventsInWindow('faq_viewed', since), 0, errors)
    const escalationsLastN = await safely('escalationsLastN', () => countEventsInWindow('chat_escalated', since), 0, errors)

    // ── Group-by breakdowns
    const byCategory = await safely('byCategory', () => countTicketsBy('category', since), [] as Array<{ key: string; count: number }>, errors)
    const byPriority = await safely('byPriority', () => countTicketsBy('priority', since), [] as Array<{ key: string; count: number }>, errors)
    const byRole = await safely('byRole', () => countTicketsBy('user_role', since), [] as Array<{ key: string; count: number }>, errors)

    // ── Resolution buckets + satisfaction distribution
    const resolutionBuckets = await safely('resolutionBuckets', () => resolutionTimeBuckets(since), [] as Array<{ bucket: string; count: number }>, errors)
    const satisfactionDist = await safely('satisfactionDistribution', () => satisfactionDistribution(since), [] as Array<{ rating: number; count: number }>, errors)

    // ── Recent chat escalations
    const recentEscalations = await safely('recentEscalations', () => findRecentEscalations(10), [], errors)

    // ── Tickets over time
    const ticketsOverTime = await safely(
      'ticketsOverTime',
      async () => {
        const rows = await pgClient<{ day: string; count: string }[]>`
          SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
                 COUNT(*)::text AS count
          FROM support_tickets
          WHERE created_at >= ${since}
          GROUP BY 1
          ORDER BY 1 ASC
        `
        return rows.map((r) => ({ day: r.day, count: Number(r.count) }))
      },
      [] as Array<{ day: string; count: number }>,
      errors,
    )

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
      _errors: errors.length > 0 ? errors : undefined,
    })
  } catch (err) {
    console.error('[admin/support/analytics GET] outer error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load analytics' },
      { status: 500 },
    )
  }
}
