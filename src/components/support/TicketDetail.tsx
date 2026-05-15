'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, Loader2, Send, Star } from 'lucide-react'
import { toast } from 'sonner'
import { apiPost } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { ChatBubble } from './ChatBubble'
import { statusBadgeClass, statusLabel, type TicketSummary } from './TicketTab'

type TicketMessage = {
  id: string
  senderType: 'user' | 'admin' | 'system' | 'ai'
  senderId: string | null
  message: string
  createdAt: string
  isInternalNote: boolean
}

type TicketFull = TicketSummary & {
  userId: string
  userEmail: string
  userRole: string
  description: string
  resolutionNotes: string | null
  resolvedAt: string | null
  closedAt: string | null
  satisfactionRating: number | null
}

export function TicketDetail({ ticketId, onBack }: { ticketId: string; onBack: () => void }) {
  const [ticket, setTicket] = useState<TicketFull | null>(null)
  const [messages, setMessages] = useState<TicketMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const [rating, setRating] = useState<number>(0)
  const [hoverRating, setHoverRating] = useState<number>(0)
  const [submittingRating, setSubmittingRating] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/support/tickets/${ticketId}`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Could not load ticket')
        return
      }
      const data = await res.json()
      setTicket(data.ticket)
      setMessages(data.messages ?? [])
      if (data.ticket?.satisfactionRating) setRating(data.ticket.satisfactionRating)
    } catch (err) {
      console.error('[TicketDetail] load failed:', err)
      setError('Network error — please try again.')
    } finally {
      setLoading(false)
    }
  }, [ticketId])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages])

  const sendReply = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reply.trim() || sending) return
    setSending(true)
    try {
      const res = await apiPost(`/api/support/tickets/${ticketId}/messages`, {
        message: reply.trim(),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || 'Could not send reply')
        return
      }
      const data = await res.json()
      setMessages((m) => [...m, data.message])
      setTicket((t) => (t ? { ...t, status: data.ticket.status, updatedAt: data.ticket.updatedAt } : t))
      setReply('')
    } catch (err) {
      console.error('[TicketDetail] reply failed:', err)
      toast.error('Network error.')
    } finally {
      setSending(false)
    }
  }

  const submitRating = async (value: number) => {
    if (submittingRating || !ticket) return
    setSubmittingRating(true)
    try {
      const res = await apiPost(`/api/support/tickets/${ticketId}/rate`, { rating: value })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || 'Could not submit rating')
        return
      }
      const data = await res.json()
      setTicket(data.ticket)
      setRating(value)
      toast.success('Thanks for the feedback!')
    } catch (err) {
      console.error('[TicketDetail] rate failed:', err)
      toast.error('Network error.')
    } finally {
      setSubmittingRating(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-1 flex-col">
        <Header onBack={onBack} title="Loading…" />
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      </div>
    )
  }

  if (error || !ticket) {
    return (
      <div className="flex flex-1 flex-col">
        <Header onBack={onBack} title="Error" />
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
          <p className="text-sm text-muted-foreground">{error || 'Ticket not found'}</p>
          <Button size="sm" variant="outline" onClick={load}>
            Try again
          </Button>
        </div>
      </div>
    )
  }

  const isClosed = ticket.status === 'resolved' || ticket.status === 'closed'
  const showRating = isClosed && !ticket.satisfactionRating

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Header
        onBack={onBack}
        title={ticket.ticketNumber}
        subtitle={ticket.subject}
        statusBadge={
          <span
            className={'rounded-full px-2 py-0.5 text-[10px] font-medium ' + statusBadgeClass(ticket.status)}
          >
            {statusLabel(ticket.status)}
          </span>
        }
      />

      {/* Thread */}
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {messages.map((m) => (
          <ChatBubble
            key={m.id}
            role={m.senderType === 'user' ? 'user' : m.senderType === 'system' ? 'system' : 'assistant'}
            content={m.message}
            timestamp={m.createdAt}
          />
        ))}

        {/* Resolution note */}
        {ticket.resolutionNotes && (
          <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-900 dark:border-green-900 dark:bg-green-950/40 dark:text-green-200">
            <div className="font-semibold mb-0.5">Resolution</div>
            <div className="whitespace-pre-wrap">{ticket.resolutionNotes}</div>
          </div>
        )}

        {/* Satisfaction rating */}
        {showRating && (
          <div className="rounded-md border border-border bg-card px-3 py-3 text-center">
            <p className="text-xs font-medium mb-2">How did we do?</p>
            <div className="flex items-center justify-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => {
                const filled = (hoverRating || rating) >= n
                return (
                  <button
                    key={n}
                    type="button"
                    disabled={submittingRating}
                    onMouseEnter={() => setHoverRating(n)}
                    onMouseLeave={() => setHoverRating(0)}
                    onClick={() => submitRating(n)}
                    className="p-0.5 disabled:opacity-50"
                    aria-label={`Rate ${n} star${n > 1 ? 's' : ''}`}
                  >
                    <Star
                      className={
                        'h-5 w-5 transition-colors ' +
                        (filled ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground')
                      }
                    />
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Already-rated indicator */}
        {isClosed && ticket.satisfactionRating != null && (
          <div className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground">
            You rated this ticket
            {[1, 2, 3, 4, 5].map((n) => (
              <Star
                key={n}
                className={
                  'h-3 w-3 ' +
                  (n <= ticket.satisfactionRating! ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground')
                }
              />
            ))}
          </div>
        )}
      </div>

      {/* Reply input (hidden when closed) */}
      {ticket.status !== 'closed' && (
        <form onSubmit={sendReply} className="border-t border-border bg-card p-3">
          <div className="flex items-end gap-2">
            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  sendReply(e)
                }
              }}
              placeholder="Type a reply…"
              disabled={sending}
              rows={1}
              className="flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
              style={{ maxHeight: '100px' }}
            />
            <Button
              type="submit"
              size="icon"
              disabled={sending || !reply.trim()}
              className="shrink-0"
              aria-label="Send reply"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}

function Header({
  onBack,
  title,
  subtitle,
  statusBadge,
}: {
  onBack: () => void
  title: string
  subtitle?: string
  statusBadge?: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-2 border-b border-border bg-card px-2 py-2.5">
      <button
        onClick={onBack}
        className="rounded-md p-1.5 text-muted-foreground hover:bg-accent transition-colors"
        aria-label="Back to ticket list"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-muted-foreground">{title}</span>
          {statusBadge}
        </div>
        {subtitle && <div className="truncate text-sm font-medium">{subtitle}</div>}
      </div>
    </div>
  )
}
