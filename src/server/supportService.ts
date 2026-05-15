import 'server-only'

/**
 * Support Service — ticket lifecycle business logic.
 *
 * Layer rules:
 *   - Calls supportRepository (DB) and supportEmailService (Resend).
 *   - Never imports from app/ or routes directly.
 *   - Email failures are logged but never thrown — ticket creation must
 *     succeed even if the email outage occurs.
 *   - eventBus emits are TODO[Phase 9]; service is event-bus-ready but
 *     handlers are wired in Phase 9.
 */

import {
  createTicket as repoCreateTicket,
  findTicketById,
  findTicketsByUser,
  findTicketsForAdmin,
  updateTicket,
  addTicketMessage,
  findMessagesByTicket,
  nextTicketNumber,
  logSupportEvent,
  type TicketListFilter,
} from '@/db/repositories/supportRepository'
import {
  sendTicketCreatedToAdmin,
  sendTicketCreatedToUser,
  sendAdminReplyToUser,
  sendUserReplyToAdmin,
  sendTicketResolvedToUser,
} from '@/server/supportEmailService'
import { emit, PLATFORM_EVENTS } from '@/server/eventBus'
import type { SupportTicket, SupportTicketMessage } from '@/db/schema'

// ════════════════════════════════════════════════════════════════
// PRIORITY INFERENCE
// ════════════════════════════════════════════════════════════════

const HIGH_PRIORITY_CATEGORIES = new Set<SupportTicket['category']>([
  'payment',
  'billing',
  'bug_report',
])
const LOW_PRIORITY_CATEGORIES = new Set<SupportTicket['category']>(['feature_request'])

export function inferPriority(category: SupportTicket['category']): SupportTicket['priority'] {
  if (HIGH_PRIORITY_CATEGORIES.has(category)) return 'high'
  if (LOW_PRIORITY_CATEGORIES.has(category)) return 'low'
  return 'medium'
}

// ════════════════════════════════════════════════════════════════
// CREATE TICKET
// ════════════════════════════════════════════════════════════════

export type CreateTicketInput = {
  userId: string
  userEmail: string
  userRole: string
  userName: string
  category: SupportTicket['category']
  subject: string
  description: string
  /** Optional override — chatbot escalation sets 'high' for urgent topics. */
  priority?: SupportTicket['priority']
  /** Optional — set when a ticket is escalated from a chat conversation. */
  escalatedFromConversationId?: string
}

export type CreatedTicket = SupportTicket & { firstMessage: SupportTicketMessage }

export async function createTicket(input: CreateTicketInput): Promise<CreatedTicket> {
  const ticketNumber = await nextTicketNumber()
  const priority = input.priority ?? inferPriority(input.category)

  const ticket = await repoCreateTicket({
    ticketNumber,
    userId: input.userId,
    userEmail: input.userEmail,
    userRole: input.userRole,
    category: input.category,
    subject: input.subject.trim(),
    description: input.description.trim(),
    status: 'open',
    priority,
  })

  // Persist the original user description as the first message so the
  // thread view shows the full conversation from message 0.
  const firstMessage = await addTicketMessage({
    ticketId: ticket.id,
    senderType: 'user',
    senderId: input.userId,
    message: input.description.trim(),
    attachments: [],
    isInternalNote: false,
  })

  // Email — fire-and-forget; never block ticket creation on email outages.
  void sendTicketCreatedToAdmin({ ticket, userName: input.userName }).catch((e) =>
    console.error('[support] admin notification failed:', e)
  )
  void sendTicketCreatedToUser({ ticket, userName: input.userName }).catch((e) =>
    console.error('[support] user confirmation failed:', e)
  )

  await logSupportEvent({
    eventType: 'ticket_created',
    userId: input.userId,
    data: {
      ticketId: ticket.id,
      ticketNumber: ticket.ticketNumber,
      category: ticket.category,
      priority: ticket.priority,
      escalatedFromConversationId: input.escalatedFromConversationId,
    },
  })

  // Real-time fan-out to all admins (Pusher + notification_inbox).
  void emit(PLATFORM_EVENTS.SUPPORT_TICKET_CREATED, {
    actorId: input.userId,
    actorRole: 'consumer',
    ticketId: ticket.id,
    ticketNumber: ticket.ticketNumber,
    subject: ticket.subject,
    category: ticket.category,
    priority: ticket.priority,
    userName: input.userName,
    userRole: input.userRole,
  }).catch((e) => console.error('[support] emit ticket_created failed:', e))

  return { ...ticket, firstMessage }
}

// ════════════════════════════════════════════════════════════════
// LIST + DETAIL
// ════════════════════════════════════════════════════════════════

export async function getUserTickets(
  userId: string,
  filter: TicketListFilter = {},
  pagination: { limit?: number; offset?: number } = {}
): Promise<SupportTicket[]> {
  return findTicketsByUser(userId, filter, pagination.limit ?? 20, pagination.offset ?? 0)
}

export async function getAdminTicketQueue(
  filter: TicketListFilter = {},
  pagination: { limit?: number; offset?: number } = {}
): Promise<SupportTicket[]> {
  return findTicketsForAdmin(filter, pagination.limit ?? 50, pagination.offset ?? 0)
}

export type TicketWithMessages = {
  ticket: SupportTicket
  messages: SupportTicketMessage[]
}

/**
 * Get a ticket with its full message thread. The caller must already
 * be authorised — this service does not duplicate the auth check that
 * happens in the route, but it DOES enforce ownership at the data layer.
 * Returns null if the ticket doesn't exist or the requester is not
 * permitted to see it.
 */
export async function getTicketDetail(
  ticketId: string,
  requester: { userId: string; isAdmin: boolean }
): Promise<TicketWithMessages | null> {
  const ticket = await findTicketById(ticketId)
  if (!ticket) return null
  if (!requester.isAdmin && ticket.userId !== requester.userId) return null
  const messages = await findMessagesByTicket(ticketId, requester.isAdmin)
  return { ticket, messages }
}

// ════════════════════════════════════════════════════════════════
// ADD MESSAGE
// ════════════════════════════════════════════════════════════════

export type AddMessageInput = {
  ticketId: string
  /** The user adding the message. */
  senderUserId: string
  /** Role of sender — drives email routing + internal-note permission. */
  senderRole: 'user' | 'admin'
  message: string
  attachments?: Array<{ name: string; url: string; size: number }>
  /** Admin only — when true, the message is hidden from the user view. */
  isInternalNote?: boolean
}

export async function addTicketReply(
  input: AddMessageInput,
  context: { userName: string }
): Promise<{ ticket: SupportTicket; message: SupportTicketMessage }> {
  const ticket = await findTicketById(input.ticketId)
  if (!ticket) throw new Error('Ticket not found')

  // Ownership: user can only reply to their own ticket; admin can reply to any.
  if (input.senderRole === 'user' && ticket.userId !== input.senderUserId) {
    throw new Error('Forbidden')
  }
  // Only admins can add internal notes.
  const isInternalNote = input.senderRole === 'admin' && input.isInternalNote === true

  const message = await addTicketMessage({
    ticketId: ticket.id,
    senderType: input.senderRole === 'admin' ? 'admin' : 'user',
    senderId: input.senderUserId,
    message: input.message.trim(),
    attachments: input.attachments ?? [],
    isInternalNote,
  })

  // Auto-transition status:
  //   - admin reply on an `open` ticket → `in_progress`
  //   - user reply on a `waiting_on_user` ticket → `in_progress`
  let nextStatus: SupportTicket['status'] | null = null
  if (input.senderRole === 'admin' && ticket.status === 'open') nextStatus = 'in_progress'
  else if (input.senderRole === 'user' && ticket.status === 'waiting_on_user') nextStatus = 'in_progress'

  const updated = nextStatus ? await updateTicket(ticket.id, { status: nextStatus }) : ticket

  // Skip emails for internal notes — they should never reach the user.
  if (!isInternalNote) {
    if (input.senderRole === 'admin') {
      void sendAdminReplyToUser({
        ticket: updated,
        userName: context.userName,
        message: input.message,
      }).catch((e) => console.error('[support] admin reply email failed:', e))
    } else {
      void sendUserReplyToAdmin({
        ticket: updated,
        userName: context.userName,
        message: input.message,
      }).catch((e) => console.error('[support] user reply email failed:', e))
    }
  }

  // Real-time fan-out — admin reply pushes to user; user reply doesn't push
  // (admin sees it in the queue refresh, and the email is sent).
  if (input.senderRole === 'admin' && !isInternalNote) {
    void emit(PLATFORM_EVENTS.SUPPORT_ADMIN_REPLY, {
      actorId: input.senderUserId,
      actorRole: 'admin',
      ticketId: updated.id,
      ticketNumber: updated.ticketNumber,
      userId: updated.userId,
      userRole: updated.userRole,
    }).catch((e) => console.error('[support] emit admin_reply failed:', e))
  }

  return { ticket: updated, message }
}

// ════════════════════════════════════════════════════════════════
// STATUS TRANSITIONS (admin only — caller enforces auth)
// ════════════════════════════════════════════════════════════════

export type UpdateStatusInput = {
  ticketId: string
  adminId: string
  status: SupportTicket['status']
  resolutionNotes?: string
}

export async function updateTicketStatus(
  input: UpdateStatusInput,
  context: { userName: string }
): Promise<SupportTicket> {
  const ticket = await findTicketById(input.ticketId)
  if (!ticket) throw new Error('Ticket not found')

  const patch: Partial<SupportTicket> = { status: input.status, assignedTo: input.adminId }
  if (input.resolutionNotes !== undefined) patch.resolutionNotes = input.resolutionNotes
  if (input.status === 'resolved' && !ticket.resolvedAt) patch.resolvedAt = new Date()
  if (input.status === 'closed' && !ticket.closedAt) patch.closedAt = new Date()

  const updated = await updateTicket(ticket.id, patch)

  // Resolution notification to user
  if (input.status === 'resolved' && ticket.status !== 'resolved') {
    void sendTicketResolvedToUser({
      ticket: updated,
      userName: context.userName,
      resolutionNotes: input.resolutionNotes ?? updated.resolutionNotes,
    }).catch((e) => console.error('[support] resolution email failed:', e))

    await logSupportEvent({
      eventType: 'ticket_resolved',
      userId: ticket.userId,
      data: {
        ticketId: ticket.id,
        ticketNumber: ticket.ticketNumber,
        resolvedByAdminId: input.adminId,
        timeToResolutionMs: updated.resolvedAt
          ? updated.resolvedAt.getTime() - ticket.createdAt.getTime()
          : null,
      },
    })

    void emit(PLATFORM_EVENTS.SUPPORT_TICKET_RESOLVED, {
      actorId: input.adminId,
      actorRole: 'admin',
      ticketId: updated.id,
      ticketNumber: updated.ticketNumber,
      userId: updated.userId,
      userRole: updated.userRole,
    }).catch((e) => console.error('[support] emit ticket_resolved failed:', e))
  } else if (input.status !== ticket.status) {
    void emit(PLATFORM_EVENTS.SUPPORT_TICKET_UPDATED, {
      actorId: input.adminId,
      actorRole: 'admin',
      ticketId: updated.id,
      ticketNumber: updated.ticketNumber,
      userId: updated.userId,
      userRole: updated.userRole,
      fromStatus: ticket.status,
      toStatus: input.status,
    }).catch((e) => console.error('[support] emit ticket_updated failed:', e))
  }

  return updated
}

// ════════════════════════════════════════════════════════════════
// ASSIGNMENT
// ════════════════════════════════════════════════════════════════

export async function assignTicket(
  ticketId: string,
  adminId: string | null
): Promise<SupportTicket> {
  const ticket = await findTicketById(ticketId)
  if (!ticket) throw new Error('Ticket not found')
  return updateTicket(ticketId, { assignedTo: adminId })
}

// ════════════════════════════════════════════════════════════════
// SATISFACTION RATING (user only)
// ════════════════════════════════════════════════════════════════

export type RateTicketInput = {
  ticketId: string
  userId: string
  rating: number
  feedback?: string
}

export async function rateTicket(input: RateTicketInput): Promise<SupportTicket> {
  if (input.rating < 1 || input.rating > 5) throw new Error('Rating must be between 1 and 5')

  const ticket = await findTicketById(input.ticketId)
  if (!ticket) throw new Error('Ticket not found')
  if (ticket.userId !== input.userId) throw new Error('Forbidden')
  // Can only rate resolved or closed tickets.
  if (ticket.status !== 'resolved' && ticket.status !== 'closed') {
    throw new Error('Ticket must be resolved before rating')
  }

  const updated = await updateTicket(input.ticketId, {
    satisfactionRating: input.rating,
    satisfactionFeedback: input.feedback ?? null,
  })

  await logSupportEvent({
    eventType: 'satisfaction',
    userId: input.userId,
    data: {
      ticketId: ticket.id,
      ticketNumber: ticket.ticketNumber,
      rating: input.rating,
      hasFeedback: !!input.feedback,
    },
  })

  return updated
}
