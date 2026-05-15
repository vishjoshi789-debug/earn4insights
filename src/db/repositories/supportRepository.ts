import 'server-only'

import { db, pgClient } from '@/db'
import {
  supportTickets,
  supportTicketMessages,
  chatConversations,
  faqArticles,
  supportAnalytics,
  type SupportTicket,
  type NewSupportTicket,
  type SupportTicketMessage,
  type NewSupportTicketMessage,
  type ChatConversation,
  type NewChatConversation,
  type FaqArticle,
  type NewFaqArticle,
  type NewSupportAnalyticsEvent,
} from '@/db/schema'
import { eq, and, desc, asc, inArray, sql, lt } from 'drizzle-orm'

// ════════════════════════════════════════════════════════════════
// TICKET NUMBERING
// ════════════════════════════════════════════════════════════════

/** Atomic, gapless ticket number from Postgres sequence. Format: E4I-0001. */
export async function nextTicketNumber(): Promise<string> {
  const rows = await pgClient.unsafe<{ n: number }[]>(`SELECT nextval('support_ticket_seq')::integer AS n`)
  const n = rows[0]?.n ?? 1
  return `E4I-${String(n).padStart(4, '0')}`
}

// ════════════════════════════════════════════════════════════════
// TICKETS
// ════════════════════════════════════════════════════════════════

export async function createTicket(
  data: Omit<NewSupportTicket, 'id' | 'createdAt' | 'updatedAt' | 'ticketNumber'> & {
    ticketNumber: string
  }
): Promise<SupportTicket> {
  const [row] = await db
    .insert(supportTickets)
    .values({ ...data, updatedAt: new Date() })
    .returning()
  return row
}

export async function findTicketById(id: string): Promise<SupportTicket | null> {
  const rows = await db.select().from(supportTickets).where(eq(supportTickets.id, id)).limit(1)
  return rows[0] ?? null
}

export async function findTicketByNumber(ticketNumber: string): Promise<SupportTicket | null> {
  const rows = await db
    .select()
    .from(supportTickets)
    .where(eq(supportTickets.ticketNumber, ticketNumber))
    .limit(1)
  return rows[0] ?? null
}

export type TicketListFilter = {
  status?: SupportTicket['status']
  category?: SupportTicket['category']
  priority?: SupportTicket['priority']
}

export async function findTicketsByUser(
  userId: string,
  filter: TicketListFilter = {},
  limit = 20,
  offset = 0
): Promise<SupportTicket[]> {
  const conds = [eq(supportTickets.userId, userId)]
  if (filter.status) conds.push(eq(supportTickets.status, filter.status))
  if (filter.category) conds.push(eq(supportTickets.category, filter.category))
  if (filter.priority) conds.push(eq(supportTickets.priority, filter.priority))
  return db
    .select()
    .from(supportTickets)
    .where(and(...conds))
    .orderBy(desc(supportTickets.createdAt))
    .limit(limit)
    .offset(offset)
}

/** Admin queue ordered urgent → low, then oldest first. */
export async function findTicketsForAdmin(
  filter: TicketListFilter = {},
  limit = 50,
  offset = 0
): Promise<SupportTicket[]> {
  const conds = []
  if (filter.status) conds.push(eq(supportTickets.status, filter.status))
  if (filter.category) conds.push(eq(supportTickets.category, filter.category))
  if (filter.priority) conds.push(eq(supportTickets.priority, filter.priority))
  const query = db
    .select()
    .from(supportTickets)
    .orderBy(
      sql`CASE ${supportTickets.priority}
            WHEN 'urgent' THEN 1
            WHEN 'high'   THEN 2
            WHEN 'medium' THEN 3
            WHEN 'low'    THEN 4
            ELSE 5
          END`,
      asc(supportTickets.createdAt)
    )
    .limit(limit)
    .offset(offset)
  return conds.length ? query.where(and(...conds)) : query
}

export async function updateTicket(
  id: string,
  data: Partial<Omit<NewSupportTicket, 'id' | 'createdAt'>>
): Promise<SupportTicket> {
  const [row] = await db
    .update(supportTickets)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(supportTickets.id, id))
    .returning()
  return row
}

/** Tickets open longer than the cutoff — used by the daily reminder cron. */
export async function findStaleOpenTickets(cutoff: Date): Promise<SupportTicket[]> {
  return db
    .select()
    .from(supportTickets)
    .where(
      and(
        inArray(supportTickets.status, ['open', 'in_progress', 'waiting_on_user']),
        lt(supportTickets.createdAt, cutoff)
      )
    )
    .orderBy(asc(supportTickets.createdAt))
}

// ════════════════════════════════════════════════════════════════
// TICKET MESSAGES
// ════════════════════════════════════════════════════════════════

export async function addTicketMessage(
  data: Omit<NewSupportTicketMessage, 'id' | 'createdAt'>
): Promise<SupportTicketMessage> {
  const [row] = await db.insert(supportTicketMessages).values(data).returning()
  // Bump parent ticket's updated_at so admin queue ordering reflects activity.
  await db
    .update(supportTickets)
    .set({ updatedAt: new Date() })
    .where(eq(supportTickets.id, data.ticketId))
  return row
}

export async function findMessagesByTicket(
  ticketId: string,
  includeInternal = false
): Promise<SupportTicketMessage[]> {
  const conds = [eq(supportTicketMessages.ticketId, ticketId)]
  if (!includeInternal) conds.push(eq(supportTicketMessages.isInternalNote, false))
  return db
    .select()
    .from(supportTicketMessages)
    .where(and(...conds))
    .orderBy(asc(supportTicketMessages.createdAt))
}

// ════════════════════════════════════════════════════════════════
// CHAT CONVERSATIONS
// ════════════════════════════════════════════════════════════════

export async function createConversation(
  data: Omit<NewChatConversation, 'id' | 'createdAt' | 'updatedAt'>
): Promise<ChatConversation> {
  const [row] = await db
    .insert(chatConversations)
    .values({ ...data, updatedAt: new Date() })
    .returning()
  return row
}

export async function findConversationById(id: string): Promise<ChatConversation | null> {
  const rows = await db
    .select()
    .from(chatConversations)
    .where(eq(chatConversations.id, id))
    .limit(1)
  return rows[0] ?? null
}

export async function findActiveConversationByUser(
  userId: string
): Promise<ChatConversation | null> {
  const rows = await db
    .select()
    .from(chatConversations)
    .where(and(eq(chatConversations.userId, userId), eq(chatConversations.status, 'active')))
    .orderBy(desc(chatConversations.createdAt))
    .limit(1)
  return rows[0] ?? null
}

export async function updateConversation(
  id: string,
  data: Partial<Omit<NewChatConversation, 'id' | 'createdAt'>>
): Promise<ChatConversation> {
  const [row] = await db
    .update(chatConversations)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(chatConversations.id, id))
    .returning()
  return row
}

// ════════════════════════════════════════════════════════════════
// FAQ ARTICLES
// ════════════════════════════════════════════════════════════════

export type FaqListFilter = {
  category?: FaqArticle['category']
  role?: string
  publishedOnly?: boolean
}

export async function listFaqArticles(
  filter: FaqListFilter = {},
  limit = 50,
  offset = 0
): Promise<FaqArticle[]> {
  const conds = []
  if (filter.category) conds.push(eq(faqArticles.category, filter.category))
  if (filter.publishedOnly !== false) conds.push(eq(faqArticles.isPublished, true))
  // Role filter: include articles with empty target_roles (all) OR containing this role.
  if (filter.role) {
    conds.push(
      sql`(array_length(${faqArticles.targetRoles}, 1) IS NULL OR ${filter.role} = ANY(${faqArticles.targetRoles}))`
    )
  }
  return db
    .select()
    .from(faqArticles)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(asc(faqArticles.displayOrder), desc(faqArticles.helpfulCount))
    .limit(limit)
    .offset(offset)
}

export async function findArticleBySlug(slug: string): Promise<FaqArticle | null> {
  const rows = await db.select().from(faqArticles).where(eq(faqArticles.slug, slug)).limit(1)
  return rows[0] ?? null
}

export async function findArticleById(id: string): Promise<FaqArticle | null> {
  const rows = await db.select().from(faqArticles).where(eq(faqArticles.id, id)).limit(1)
  return rows[0] ?? null
}

export async function createArticle(
  data: Omit<NewFaqArticle, 'id' | 'createdAt' | 'updatedAt'>
): Promise<FaqArticle> {
  const [row] = await db
    .insert(faqArticles)
    .values({ ...data, updatedAt: new Date() })
    .returning()
  return row
}

export async function updateArticle(
  id: string,
  data: Partial<Omit<NewFaqArticle, 'id' | 'createdAt'>>
): Promise<FaqArticle> {
  const [row] = await db
    .update(faqArticles)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(faqArticles.id, id))
    .returning()
  return row
}

export async function deleteArticle(id: string): Promise<void> {
  await db.delete(faqArticles).where(eq(faqArticles.id, id))
}

export async function incrementArticleView(id: string): Promise<void> {
  await db
    .update(faqArticles)
    .set({ viewCount: sql`${faqArticles.viewCount} + 1`, updatedAt: new Date() })
    .where(eq(faqArticles.id, id))
}

export async function rateArticle(id: string, helpful: boolean): Promise<void> {
  await db
    .update(faqArticles)
    .set(
      helpful
        ? { helpfulCount: sql`${faqArticles.helpfulCount} + 1`, updatedAt: new Date() }
        : { notHelpfulCount: sql`${faqArticles.notHelpfulCount} + 1`, updatedAt: new Date() }
    )
    .where(eq(faqArticles.id, id))
}

/**
 * Keyword search using tsvector + ts_rank (for /help public page).
 * Returns top matches ranked by relevance.
 */
export async function searchArticlesByKeyword(
  query: string,
  role?: string,
  limit = 10
): Promise<FaqArticle[]> {
  const rows = await pgClient<FaqArticle[]>`
    SELECT *
    FROM faq_articles
    WHERE is_published = true
      AND search_vector @@ plainto_tsquery('english', ${query})
      AND (
        array_length(target_roles, 1) IS NULL
        OR ${role ?? null}::text IS NULL
        OR ${role ?? null}::text = ANY(target_roles)
      )
    ORDER BY ts_rank(search_vector, plainto_tsquery('english', ${query})) DESC,
             helpful_count DESC
    LIMIT ${limit}
  `
  return rows as FaqArticle[]
}

/**
 * Semantic search using pgvector cosine similarity (for chatbot FAQ matching).
 * Returns articles ordered by similarity to the query embedding.
 * The caller must provide a 1536-dim embedding (text-embedding-3-small).
 *
 * `minSimilarity` (0..1) filters out poor matches — caller supplies the cutoff
 * (e.g. 0.75 for chatbot "good match" gate).
 */
export async function searchArticlesByEmbedding(
  embedding: number[],
  options: { role?: string; minSimilarity?: number; limit?: number } = {}
): Promise<Array<FaqArticle & { similarity: number }>> {
  const { role, minSimilarity = 0, limit = 5 } = options
  // pgvector requires the embedding as a string literal like '[0.1,0.2,...]'.
  const literal = `[${embedding.join(',')}]`
  const rows = await pgClient<Array<FaqArticle & { similarity: number }>>`
    SELECT *,
           1 - (embedding <=> ${literal}::vector) AS similarity
    FROM faq_articles
    WHERE is_published = true
      AND embedding IS NOT NULL
      AND (
        array_length(target_roles, 1) IS NULL
        OR ${role ?? null}::text IS NULL
        OR ${role ?? null}::text = ANY(target_roles)
      )
      AND 1 - (embedding <=> ${literal}::vector) >= ${minSimilarity}
    ORDER BY embedding <=> ${literal}::vector ASC
    LIMIT ${limit}
  `
  return rows as Array<FaqArticle & { similarity: number }>
}

/** Set the embedding for an article (used by seed + admin edit routes). */
export async function setArticleEmbedding(id: string, embedding: number[]): Promise<void> {
  const literal = `[${embedding.join(',')}]`
  await pgClient`
    UPDATE faq_articles
    SET embedding = ${literal}::vector,
        updated_at = NOW()
    WHERE id = ${id}
  `
}

// ════════════════════════════════════════════════════════════════
// SUPPORT ANALYTICS
// ════════════════════════════════════════════════════════════════

export async function logSupportEvent(
  data: Omit<NewSupportAnalyticsEvent, 'id' | 'createdAt'>
): Promise<void> {
  await db.insert(supportAnalytics).values(data)
}

/** Count events in a window — used by admin analytics dashboard. */
export async function countEventsInWindow(
  eventType: NewSupportAnalyticsEvent['eventType'],
  since: Date
): Promise<number> {
  const rows = await pgClient<{ count: string }[]>`
    SELECT COUNT(*)::text AS count
    FROM support_analytics
    WHERE event_type = ${eventType}
      AND created_at >= ${since}
  `
  return Number(rows[0]?.count ?? 0)
}

/** Recent chat → ticket escalations for the admin dashboard. */
export type RecentEscalation = {
  conversationId: string
  ticketId: string
  ticketNumber: string
  subject: string
  userId: string
  userRole: string
  totalMessages: number
  escalatedAt: string
}

export async function findRecentEscalations(limit = 10): Promise<RecentEscalation[]> {
  const rows = await pgClient<RecentEscalation[]>`
    SELECT
      c.id AS "conversationId",
      t.id AS "ticketId",
      t.ticket_number AS "ticketNumber",
      t.subject AS "subject",
      c.user_id AS "userId",
      c.user_role AS "userRole",
      c.total_messages AS "totalMessages",
      c.updated_at::text AS "escalatedAt"
    FROM chat_conversations c
    INNER JOIN support_tickets t ON t.id = c.escalated_to_ticket_id
    WHERE c.status = 'escalated' AND c.escalated_to_ticket_id IS NOT NULL
    ORDER BY c.updated_at DESC
    LIMIT ${limit}
  `
  return rows as RecentEscalation[]
}

/** Ticket counts grouped by a single column (category | priority | userRole). */
export async function countTicketsBy(
  column: 'category' | 'priority' | 'user_role',
  since: Date
): Promise<Array<{ key: string; count: number }>> {
  // column is a hardcoded union — safe to interpolate.
  const rows = await pgClient<{ key: string; count: string }[]>`
    SELECT ${pgClient(column)} AS key, COUNT(*)::text AS count
    FROM support_tickets
    WHERE created_at >= ${since}
    GROUP BY 1
    ORDER BY count DESC
  `
  return rows.map((r) => ({ key: r.key, count: Number(r.count) }))
}

/** Bucket resolution time into histogram buckets for the admin chart. */
export async function resolutionTimeBuckets(
  since: Date
): Promise<{ bucket: string; count: number }[]> {
  const rows = await pgClient<{ bucket: string; count: string }[]>`
    SELECT bucket, COUNT(*)::text AS count
    FROM (
      SELECT
        CASE
          WHEN EXTRACT(EPOCH FROM (resolved_at - created_at)) < 3600 THEN '<1h'
          WHEN EXTRACT(EPOCH FROM (resolved_at - created_at)) < 14400 THEN '1-4h'
          WHEN EXTRACT(EPOCH FROM (resolved_at - created_at)) < 86400 THEN '4-24h'
          WHEN EXTRACT(EPOCH FROM (resolved_at - created_at)) < 259200 THEN '1-3d'
          ELSE '>3d'
        END AS bucket
      FROM support_tickets
      WHERE resolved_at IS NOT NULL AND created_at >= ${since}
    ) t
    GROUP BY bucket
    ORDER BY array_position(ARRAY['<1h','1-4h','4-24h','1-3d','>3d'], bucket)
  `
  return rows.map((r) => ({ bucket: r.bucket, count: Number(r.count) }))
}

/** Open tickets older than `olderThanHours` with no public admin reply yet. */
export async function findOpenTicketsWithoutAdminReply(
  olderThanHours: number
): Promise<SupportTicket[]> {
  const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000)
  const rows = await pgClient<SupportTicket[]>`
    SELECT t.*
    FROM support_tickets t
    WHERE t.status = 'open'
      AND t.created_at < ${cutoff}
      AND NOT EXISTS (
        SELECT 1 FROM support_ticket_messages m
        WHERE m.ticket_id = t.id
          AND m.sender_type = 'admin'
          AND m.is_internal_note = false
      )
    ORDER BY t.created_at ASC
    LIMIT 200
  `
  return rows as SupportTicket[]
}

/**
 * `in_progress` tickets where the most recent public admin reply is older
 * than `olderThanHours` (or there is no admin reply at all). Treats tickets
 * with no admin reply as needing follow-up if any user activity has occurred.
 */
export async function findInProgressTicketsWithoutRecentAdminReply(
  olderThanHours: number
): Promise<SupportTicket[]> {
  const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000)
  const rows = await pgClient<SupportTicket[]>`
    SELECT t.*
    FROM support_tickets t
    LEFT JOIN LATERAL (
      SELECT MAX(m.created_at) AS last_admin_at
      FROM support_ticket_messages m
      WHERE m.ticket_id = t.id
        AND m.sender_type = 'admin'
        AND m.is_internal_note = false
    ) am ON true
    WHERE t.status = 'in_progress'
      AND (am.last_admin_at IS NULL OR am.last_admin_at < ${cutoff})
    ORDER BY COALESCE(am.last_admin_at, t.created_at) ASC
    LIMIT 200
  `
  return rows as SupportTicket[]
}

/** Satisfaction rating distribution (1..5) for the admin dashboard. */
export async function satisfactionDistribution(
  since: Date
): Promise<{ rating: number; count: number }[]> {
  const rows = await pgClient<{ rating: number; count: string }[]>`
    SELECT satisfaction_rating AS rating, COUNT(*)::text AS count
    FROM support_tickets
    WHERE satisfaction_rating IS NOT NULL AND created_at >= ${since}
    GROUP BY 1
    ORDER BY 1 ASC
  `
  return rows.map((r) => ({ rating: Number(r.rating), count: Number(r.count) }))
}
