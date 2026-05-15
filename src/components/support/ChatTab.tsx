'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Send, Sparkles, AlertCircle, Ticket, ThumbsUp, ThumbsDown } from 'lucide-react'
import { toast } from 'sonner'
import { apiPost } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { ChatBubble, TypingIndicator } from './ChatBubble'

export type ChatRole = 'brand' | 'consumer' | 'influencer'

type Message = {
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: string
  outcome?: 'faq' | 'ai' | 'flagged' | 'blocked'
  suggestTicket?: boolean
}

type QuickAction = { id: string; label: string; prompt: string }

const FAQ_TAB_TOKEN = '__open_faq_tab__'

export function ChatTab({
  role,
  onSwitchToFaq,
  onEscalated,
}: {
  role: ChatRole
  onSwitchToFaq: () => void
  onEscalated: () => void
}) {
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [quickActions, setQuickActions] = useState<QuickAction[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)
  const [blocked, setBlocked] = useState(false)
  const [escalating, setEscalating] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to latest
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, sending])

  // Lazy-start conversation on first mount
  const startSession = useCallback(async () => {
    if (conversationId || starting) return
    setStarting(true)
    setStartError(null)
    try {
      const currentPage = typeof window !== 'undefined' ? window.location.pathname : null
      const res = await apiPost('/api/support/chat/start', { currentPage, role })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setStartError(data.error || 'Could not start chat')
        return
      }
      const data = await res.json()
      setConversationId(data.conversationId)
      setQuickActions(data.quickActions ?? [])
      setMessages([
        {
          role: 'assistant',
          content: data.greeting,
          timestamp: new Date().toISOString(),
        },
      ])
    } catch (err) {
      console.error('[ChatTab] start failed:', err)
      setStartError('Could not reach the support service. Please try again.')
    } finally {
      setStarting(false)
    }
  }, [conversationId, role, starting])

  useEffect(() => {
    startSession()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const sendUserMessage = useCallback(
    async (text: string) => {
      if (!conversationId || !text.trim() || sending || blocked) return
      const trimmed = text.trim()
      const ts = new Date().toISOString()
      setMessages((m) => [...m, { role: 'user', content: trimmed, timestamp: ts }])
      setInput('')
      setSending(true)
      try {
        const res = await apiPost('/api/support/chat/message', {
          conversationId,
          message: trimmed,
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          setMessages((m) => [
            ...m,
            {
              role: 'system',
              content: data.error || 'Something went wrong sending that message.',
              timestamp: new Date().toISOString(),
            },
          ])
          return
        }
        const outcome = await res.json()
        const reply: Message = {
          role: 'assistant',
          content: outcome.reply,
          timestamp: new Date().toISOString(),
          outcome: outcome.kind,
          suggestTicket: outcome.kind === 'ai' ? !!outcome.suggestTicket : false,
        }
        setMessages((m) => [...m, reply])
        if (outcome.kind === 'blocked') setBlocked(true)
      } catch (err) {
        console.error('[ChatTab] send failed:', err)
        setMessages((m) => [
          ...m,
          {
            role: 'system',
            content: 'Network error — please try again.',
            timestamp: new Date().toISOString(),
          },
        ])
      } finally {
        setSending(false)
      }
    },
    [blocked, conversationId, sending]
  )

  const handleQuickAction = useCallback(
    (action: QuickAction) => {
      if (action.prompt === FAQ_TAB_TOKEN) {
        onSwitchToFaq()
        return
      }
      sendUserMessage(action.prompt)
    },
    [onSwitchToFaq, sendUserMessage]
  )

  const escalate = useCallback(async () => {
    if (!conversationId || escalating) return
    setEscalating(true)
    try {
      const res = await apiPost(`/api/support/chat/${conversationId}/escalate`, {})
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || 'Could not create ticket')
        return
      }
      const data = await res.json()
      toast.success(`Ticket ${data.ticket.ticketNumber} created — our team will respond shortly.`)
      onEscalated()
    } catch (err) {
      console.error('[ChatTab] escalate failed:', err)
      toast.error('Network error — please try again.')
    } finally {
      setEscalating(false)
    }
  }, [conversationId, escalating, onEscalated])

  const markHelpful = useCallback(
    async (helpful: boolean) => {
      if (!conversationId) return
      if (helpful) {
        const res = await apiPost(`/api/support/chat/${conversationId}/resolve`, {})
        if (res.ok) {
          toast.success('Glad I could help!')
          setMessages((m) => [
            ...m,
            {
              role: 'system',
              content: 'Conversation marked as resolved.',
              timestamp: new Date().toISOString(),
            },
          ])
        }
      } else {
        await escalate()
      }
    },
    [conversationId, escalate]
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    sendUserMessage(input)
  }

  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant')
  const showHelpfulButtons =
    !blocked && lastAssistant && (lastAssistant.outcome === 'faq' || lastAssistant.outcome === 'ai')
  const showEscalate =
    !blocked && lastAssistant && lastAssistant.outcome === 'ai' && !!lastAssistant.suggestTicket

  // ── Error state ─────────────────────────────────────────────────
  if (startError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <AlertCircle className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{startError}</p>
        <Button size="sm" variant="outline" onClick={startSession}>
          Try again
        </Button>
      </div>
    )
  }

  // ── Loading / starting state ────────────────────────────────────
  if (starting && messages.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <Sparkles className="h-8 w-8 animate-pulse text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Starting your support session…</p>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {messages.map((m, i) => (
          <ChatBubble key={i} role={m.role} content={m.content} timestamp={m.timestamp} />
        ))}
        {sending && <TypingIndicator />}

        {/* Quick actions — shown only at the top of a fresh conversation */}
        {messages.length === 1 && quickActions.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-2">
            {quickActions.map((qa) => (
              <button
                key={qa.id}
                onClick={() => handleQuickAction(qa)}
                className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                {qa.label}
              </button>
            ))}
          </div>
        )}

        {/* "Was this helpful?" */}
        {showHelpfulButtons && !sending && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-[11px] text-muted-foreground">Was this helpful?</span>
            <button
              onClick={() => markHelpful(true)}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-medium hover:bg-accent transition-colors"
            >
              <ThumbsUp className="h-3 w-3" />
              Yes
            </button>
            <button
              onClick={() => markHelpful(false)}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-medium hover:bg-accent transition-colors"
            >
              <ThumbsDown className="h-3 w-3" />
              No, create ticket
            </button>
          </div>
        )}

        {/* Soft escalation suggestion */}
        {showEscalate && !sending && (
          <div className="pt-1">
            <Button
              size="sm"
              variant="outline"
              className="w-full gap-1.5"
              disabled={escalating}
              onClick={escalate}
            >
              <Ticket className="h-3.5 w-3.5" />
              {escalating ? 'Creating ticket…' : 'Create support ticket'}
            </Button>
          </div>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="border-t border-border bg-card p-3">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSubmit(e)
              }
            }}
            placeholder={blocked ? 'Chat has ended.' : 'Type your message…'}
            disabled={blocked || sending}
            rows={1}
            className="flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            style={{ maxHeight: '100px' }}
          />
          <Button
            type="submit"
            size="icon"
            disabled={blocked || sending || !input.trim()}
            className="shrink-0"
            aria-label="Send"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="mt-1.5 text-[10px] text-muted-foreground">
          AI assistant — may make mistakes. Sensitive billing queries are routed to our team.
        </p>
      </form>
    </div>
  )
}
