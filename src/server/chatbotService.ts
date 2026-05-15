import 'server-only'

/**
 * Chatbot Service — the core support bot.
 *
 * Flow per message (sendMessage):
 *   1. Heuristic suspicious-intent filter (chatbot-knowledge-base).
 *      Flag tracking lives in conversation.context — at 3 flags we
 *      hard-block the conversation (marked resolved by AI, not
 *      escalated, so abusive sessions don't fan out as tickets).
 *   2. Semantic FAQ search (pgvector, ≥0.78 similarity).
 *      On match → return the article excerpt + link, ask "Was this
 *      helpful?". Cheap, deterministic, and verifiable.
 *   3. GPT-4o-mini fallback. System prompt is built per role + user
 *      context; conversation history truncated to last 10 messages;
 *      temperature 0.3, max_tokens 500.
 *   4. After 6 unresolved messages, append the escalation prompt
 *      so the user can promote the chat into a ticket.
 *
 * Escalation (escalateToTicket):
 *   - Single GPT call classifies the conversation into one of the 13
 *     ticket categories AND writes a concise subject + description.
 *   - Falls back to safe defaults if classification fails.
 *   - Creates the ticket via supportService.createTicket and links
 *     the conversation row to it.
 *
 * Privacy/safety:
 *   - System prompt forbids invented facts, internal-business data,
 *     other-user info, prompt extraction (see chatbot-knowledge-base).
 *   - OpenAI errors fall back to a friendly "create a ticket" prompt
 *     instead of failing the request — the assistant never 500s.
 */

import OpenAI from 'openai'
import { db } from '@/db'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'

import {
  createConversation,
  findConversationById,
  updateConversation,
  logSupportEvent,
  countEventsInWindow,
} from '@/db/repositories/supportRepository'
import { searchBySemantic } from '@/server/faqService'
import { createTicket } from '@/server/supportService'
import { sendChatEscalationToAdmin } from '@/server/supportEmailService'
import {
  getChatbotSystemPrompt,
  getGreeting,
  getQuickActions,
  detectSuspiciousIntent,
  FLAGGED_RESPONSE,
  BLOCKED_RESPONSE,
  OPENAI_ERROR_RESPONSE,
  ESCALATION_PROMPT,
  type ChatbotRole,
  type ChatbotUserContext,
  type QuickAction,
} from '@/server/chatbot-knowledge-base'
import type { ChatConversation, SupportTicket } from '@/db/schema'

// ════════════════════════════════════════════════════════════════
// CONFIG
// ════════════════════════════════════════════════════════════════

const CHAT_MODEL = process.env.CHATBOT_MODEL || 'gpt-4o-mini'
const CLASSIFY_MODEL = process.env.CHATBOT_CLASSIFY_MODEL || 'gpt-4o-mini'
const CHAT_TEMPERATURE = 0.3
const CHAT_MAX_TOKENS = 500
const HISTORY_WINDOW = 10
const ESCALATION_THRESHOLD = 6
const SUSPICION_BLOCK_THRESHOLD = 3
const FAQ_SIMILARITY_CUTOFF = 0.78

let openai: OpenAI | null = null
function getOpenAI(): OpenAI {
  if (!openai) openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  return openai
}

// ════════════════════════════════════════════════════════════════
// TYPES
// ════════════════════════════════════════════════════════════════

type ChatMessage = { role: 'user' | 'assistant'; content: string; timestamp: string }
type ChatContext = ChatbotUserContext & {
  /** Counter for suspicious-intent flags. At SUSPICION_BLOCK_THRESHOLD we hard-block. */
  flagCount?: number
  /** Last few suspicious pattern names — used by admin review. */
  flagHistory?: string[]
  /** Conversation marked as terminated by the bot. No further responses. */
  blocked?: boolean
}

export type SendMessageOutcome =
  | { kind: 'faq'; reply: string; articleSlug: string; askedHelpful: true }
  | { kind: 'ai'; reply: string; askedHelpful: true; suggestTicket: boolean }
  | { kind: 'flagged'; reply: string; flagsRemaining: number }
  | { kind: 'blocked'; reply: string }

export type StartConversationOutcome = {
  conversation: ChatConversation
  greeting: string
  quickActions: QuickAction[]
}

// ════════════════════════════════════════════════════════════════
// START CONVERSATION
// ════════════════════════════════════════════════════════════════

export async function startConversation(input: {
  userId: string
  userRole: ChatbotRole
  context?: Partial<ChatbotUserContext>
}): Promise<StartConversationOutcome> {
  // Look up the user once for the greeting and context.
  const [u] = await db.select({ name: users.name }).from(users).where(eq(users.id, input.userId)).limit(1)
  const userName = u?.name ?? null

  const initContext: ChatContext = {
    userName,
    currentPage: input.context?.currentPage ?? null,
    recentActions: input.context?.recentActions ?? null,
    activeTicketCount: input.context?.activeTicketCount ?? null,
    accountAgeDays: input.context?.accountAgeDays ?? null,
    flagCount: 0,
    flagHistory: [],
    blocked: false,
  }

  const greeting = getGreeting(userName, input.userRole)
  const conversation = await createConversation({
    userId: input.userId,
    userRole: input.userRole,
    status: 'active',
    messages: [{ role: 'assistant', content: greeting, timestamp: new Date().toISOString() }],
    context: initContext,
    totalMessages: 1,
    resolvedByAi: false,
  })

  await logSupportEvent({
    eventType: 'chat_started',
    userId: input.userId,
    data: { conversationId: conversation.id, role: input.userRole },
  })

  return {
    conversation,
    greeting,
    quickActions: getQuickActions(input.userRole),
  }
}

// ════════════════════════════════════════════════════════════════
// SEND MESSAGE
// ════════════════════════════════════════════════════════════════

export async function sendMessage(input: {
  conversationId: string
  userId: string
  message: string
}): Promise<SendMessageOutcome> {
  const conversation = await findConversationById(input.conversationId)
  if (!conversation) throw new Error('Conversation not found')
  if (conversation.userId !== input.userId) throw new Error('Forbidden')
  if (conversation.status !== 'active') throw new Error('Conversation is closed')

  const role = conversation.userRole as ChatbotRole
  const ctx = (conversation.context ?? {}) as ChatContext
  const userMessage = input.message.trim()
  if (!userMessage) throw new Error('Empty message')

  // ── 1. Hard block (already terminated) ─────────────────────────
  if (ctx.blocked) {
    return { kind: 'blocked', reply: BLOCKED_RESPONSE }
  }

  // ── 2. Suspicious-intent filter ───────────────────────────────
  const flag = detectSuspiciousIntent(userMessage)
  if (flag.matched) {
    const newFlagCount = (ctx.flagCount ?? 0) + 1
    const newFlagHistory = [...(ctx.flagHistory ?? []), flag.pattern].slice(-10)
    const newMessages = appendMessages(conversation.messages as ChatMessage[], userMessage, FLAGGED_RESPONSE)

    if (newFlagCount >= SUSPICION_BLOCK_THRESHOLD) {
      // Hard-block: terminate the conversation, do NOT escalate to ticket.
      const blockedCtx: ChatContext = {
        ...ctx,
        flagCount: newFlagCount,
        flagHistory: newFlagHistory,
        blocked: true,
      }
      await updateConversation(conversation.id, {
        messages: appendMessages(conversation.messages as ChatMessage[], userMessage, BLOCKED_RESPONSE),
        context: blockedCtx,
        totalMessages: conversation.totalMessages + 2,
        status: 'resolved',
        resolvedByAi: true,
      })
      await logSupportEvent({
        eventType: 'chat_resolved_by_ai',
        userId: input.userId,
        data: {
          conversationId: conversation.id,
          reason: 'auto_blocked_suspicious',
          flagCount: newFlagCount,
          patterns: newFlagHistory,
        },
      })
      console.warn(
        `[CHAT_SUSPICIOUS_BLOCK] conversationId=${conversation.id} userId=${input.userId} patterns=${newFlagHistory.join(',')}`
      )
      return { kind: 'blocked', reply: BLOCKED_RESPONSE }
    }

    // Soft flag: politely refuse, do not feed GPT.
    const updatedCtx: ChatContext = { ...ctx, flagCount: newFlagCount, flagHistory: newFlagHistory }
    await updateConversation(conversation.id, {
      messages: newMessages,
      context: updatedCtx,
      totalMessages: conversation.totalMessages + 2,
    })
    console.warn(
      `[CHAT_SUSPICIOUS_FLAG] conversationId=${conversation.id} userId=${input.userId} pattern=${flag.pattern} flagCount=${newFlagCount}`
    )
    return {
      kind: 'flagged',
      reply: FLAGGED_RESPONSE,
      flagsRemaining: Math.max(0, SUSPICION_BLOCK_THRESHOLD - newFlagCount),
    }
  }

  // ── 3. Semantic FAQ search ────────────────────────────────────
  let faqMatch: Awaited<ReturnType<typeof searchBySemantic>>[number] | null = null
  try {
    const matches = await searchBySemantic(userMessage, {
      role,
      limit: 1,
      minSimilarity: FAQ_SIMILARITY_CUTOFF,
    })
    if (matches.length) faqMatch = matches[0]
  } catch (err) {
    console.error('[chatbot] FAQ search failed (continuing with GPT):', err)
  }

  if (faqMatch) {
    const reply = composeFaqReply(faqMatch.title, faqMatch.excerpt, faqMatch.slug)
    const newMessages = appendMessages(conversation.messages as ChatMessage[], userMessage, reply)
    await updateConversation(conversation.id, {
      messages: newMessages,
      totalMessages: conversation.totalMessages + 2,
    })
    return { kind: 'faq', reply, articleSlug: faqMatch.slug, askedHelpful: true }
  }

  // ── 4. GPT-4o-mini fallback ───────────────────────────────────
  const systemPrompt = getChatbotSystemPrompt(role, ctx)
  const history = (conversation.messages as ChatMessage[]).slice(-HISTORY_WINDOW)
  let aiReply = OPENAI_ERROR_RESPONSE

  try {
    const completion = await getOpenAI().chat.completions.create({
      model: CHAT_MODEL,
      temperature: CHAT_TEMPERATURE,
      max_tokens: CHAT_MAX_TOKENS,
      messages: [
        { role: 'system', content: systemPrompt },
        ...history.map((m) => ({ role: m.role, content: m.content })),
        { role: 'user', content: userMessage },
      ],
    })
    const content = completion.choices[0]?.message?.content?.trim()
    if (content) aiReply = content
  } catch (err) {
    console.error('[chatbot] GPT call failed:', err)
  }

  const newTotal = conversation.totalMessages + 2
  const suggestTicket = newTotal >= ESCALATION_THRESHOLD * 2 // user has sent ≥ ESCALATION_THRESHOLD msgs
  const replyWithEscalation = suggestTicket ? `${aiReply}\n\n${ESCALATION_PROMPT}` : aiReply

  await updateConversation(conversation.id, {
    messages: appendMessages(conversation.messages as ChatMessage[], userMessage, replyWithEscalation),
    totalMessages: newTotal,
  })

  return { kind: 'ai', reply: replyWithEscalation, askedHelpful: true, suggestTicket }
}

// ════════════════════════════════════════════════════════════════
// ESCALATE TO TICKET
// ════════════════════════════════════════════════════════════════

export async function escalateToTicket(input: {
  conversationId: string
  userId: string
}): Promise<SupportTicket> {
  const conversation = await findConversationById(input.conversationId)
  if (!conversation) throw new Error('Conversation not found')
  if (conversation.userId !== input.userId) throw new Error('Forbidden')

  // Blocked conversations cannot escalate — that's how the abuse mitigation
  // stays effective. Same applies if it's already been escalated.
  const ctx = (conversation.context ?? {}) as ChatContext
  if (ctx.blocked) throw new Error('Conversation is blocked')
  if (conversation.status === 'escalated' && conversation.escalatedToTicketId) {
    throw new Error('Conversation already escalated')
  }

  const [u] = await db
    .select({ name: users.name, email: users.email })
    .from(users)
    .where(eq(users.id, input.userId))
    .limit(1)
  if (!u) throw new Error('User not found')
  const userName = u.name ?? ''
  const userEmail = u.email

  // Classify the conversation into category + subject + description.
  const classified = await classifyConversation({
    messages: conversation.messages as ChatMessage[],
    role: conversation.userRole as ChatbotRole,
  })

  const ticket = await createTicket({
    userId: input.userId,
    userEmail,
    userRole: conversation.userRole,
    userName,
    category: classified.category,
    subject: classified.subject,
    description: classified.description,
    escalatedFromConversationId: conversation.id,
  })

  await updateConversation(conversation.id, {
    status: 'escalated',
    escalatedToTicketId: ticket.id,
  })

  await logSupportEvent({
    eventType: 'chat_escalated',
    userId: input.userId,
    data: {
      conversationId: conversation.id,
      ticketId: ticket.id,
      ticketNumber: ticket.ticketNumber,
      category: ticket.category,
      messageCount: conversation.totalMessages,
    },
  })

  // Notification 6 — chat escalation to admin inbox.
  // Fire-and-forget; escalation must not block on email outages.
  void sendChatEscalationToAdmin({
    ticket,
    userName,
    conversationId: conversation.id,
    totalMessages: conversation.totalMessages,
    recentMessages: (conversation.messages as ChatMessage[])
      .slice(-5)
      .map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
  }).catch((e) => console.error('[chatbot] escalation email failed:', e))

  return ticket
}

// ════════════════════════════════════════════════════════════════
// RESOLVE / RATE
// ════════════════════════════════════════════════════════════════

export async function resolveConversation(input: {
  conversationId: string
  userId: string
}): Promise<ChatConversation> {
  const conversation = await findConversationById(input.conversationId)
  if (!conversation) throw new Error('Conversation not found')
  if (conversation.userId !== input.userId) throw new Error('Forbidden')
  if (conversation.status !== 'active') return conversation

  const updated = await updateConversation(conversation.id, {
    status: 'resolved',
    resolvedByAi: true,
  })

  await logSupportEvent({
    eventType: 'chat_resolved_by_ai',
    userId: input.userId,
    data: { conversationId: conversation.id, reason: 'user_marked_resolved' },
  })

  return updated
}

export async function rateConversation(input: {
  conversationId: string
  userId: string
  rating: number
}): Promise<ChatConversation> {
  if (input.rating < 1 || input.rating > 5) throw new Error('Rating must be between 1 and 5')

  const conversation = await findConversationById(input.conversationId)
  if (!conversation) throw new Error('Conversation not found')
  if (conversation.userId !== input.userId) throw new Error('Forbidden')

  const updated = await updateConversation(conversation.id, { satisfactionRating: input.rating })

  await logSupportEvent({
    eventType: 'satisfaction',
    userId: input.userId,
    data: { conversationId: conversation.id, rating: input.rating, source: 'chat' },
  })

  return updated
}

// ════════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════════

function appendMessages(
  existing: ChatMessage[],
  userMessage: string,
  assistantReply: string
): ChatMessage[] {
  const now = new Date().toISOString()
  return [
    ...existing,
    { role: 'user', content: userMessage, timestamp: now },
    { role: 'assistant', content: assistantReply, timestamp: now },
  ]
}

function composeFaqReply(title: string, excerpt: string, slug: string): string {
  const url = `${process.env.NEXT_PUBLIC_APP_URL || 'https://earn4insights.com'}/help/${slug}`
  return `Here's what we have on **${title}**:\n\n${excerpt}\n\n[Read the full article](${url})\n\nDid that answer your question?`
}

// ── Classification: conversation → ticket subject + category + description ──

type ConversationClassification = {
  category: SupportTicket['category']
  subject: string
  description: string
}

const VALID_CATEGORIES: ReadonlyArray<SupportTicket['category']> = [
  'account', 'payment', 'campaign', 'feedback', 'technical', 'billing',
  'feature_request', 'bug_report', 'influencer', 'deals', 'community',
  'competitive_intel', 'other',
] as const

async function classifyConversation(params: {
  messages: ChatMessage[]
  role: ChatbotRole
}): Promise<ConversationClassification> {
  const transcript = params.messages
    .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n\n')

  const firstUserMsg = params.messages.find((m) => m.role === 'user')?.content ?? ''
  const fallback: ConversationClassification = {
    category: 'other',
    subject: firstUserMsg.slice(0, 100) || 'Support request from chat',
    description: transcript.slice(0, 2000) || firstUserMsg,
  }

  try {
    const completion = await getOpenAI().chat.completions.create({
      model: CLASSIFY_MODEL,
      temperature: 0.1,
      max_tokens: 400,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `Classify a customer-support chat into a structured ticket. Respond with JSON: { "category": one of [${VALID_CATEGORIES.join(', ')}], "subject": short title (≤80 chars), "description": one-paragraph summary of the user's issue (≤500 chars). The user role is ${params.role}. Choose the most specific category. Never invent details not in the chat.`,
        },
        { role: 'user', content: transcript },
      ],
    })
    const raw = completion.choices[0]?.message?.content
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as Partial<ConversationClassification>
    const category =
      parsed.category && (VALID_CATEGORIES as readonly string[]).includes(parsed.category)
        ? (parsed.category as SupportTicket['category'])
        : 'other'
    const subject = (parsed.subject ?? '').trim().slice(0, 100) || fallback.subject
    const description = (parsed.description ?? '').trim().slice(0, 2000) || fallback.description
    return { category, subject, description }
  } catch (err) {
    console.error('[chatbot] classification failed; using fallback:', err)
    return fallback
  }
}

// ════════════════════════════════════════════════════════════════
// ADMIN HELPERS — kept here so the support analytics page can pull
// aggregate metrics without re-importing the repo
// ════════════════════════════════════════════════════════════════

export async function getAiResolutionRate(
  windowDays = 30
): Promise<{ started: number; resolvedByAi: number; rate: number }> {
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000)
  const started = await countEventsInWindow('chat_started', since)
  const resolvedByAi = await countEventsInWindow('chat_resolved_by_ai', since)
  const rate = started > 0 ? resolvedByAi / started : 0
  return { started, resolvedByAi, rate }
}
