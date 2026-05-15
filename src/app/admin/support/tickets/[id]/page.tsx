'use client'

import { use, useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import {
  ChevronLeft, Loader2, Send, ShieldAlert, StickyNote, User as UserIcon, Star,
  AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'
import { apiPost, apiPut } from '@/lib/api-client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { ChatMarkdown } from '@/components/support/markdown'

// ── Types ──────────────────────────────────────────────────────────

type Status = 'open' | 'in_progress' | 'waiting_on_user' | 'resolved' | 'closed'
type Priority = 'low' | 'medium' | 'high' | 'urgent'
type Category = string

type AdminTicket = {
  id: string
  ticketNumber: string
  userId: string
  userEmail: string
  userRole: string
  category: Category
  subject: string
  description: string
  status: Status
  priority: Priority
  assignedTo: string | null
  resolutionNotes: string | null
  resolvedAt: string | null
  closedAt: string | null
  satisfactionRating: number | null
  satisfactionFeedback: string | null
  createdAt: string
  updatedAt: string
}

type TicketMessage = {
  id: string
  senderType: 'user' | 'admin' | 'system' | 'ai'
  senderId: string | null
  message: string
  attachments: unknown
  isInternalNote: boolean
  createdAt: string
}

// ── Styles ─────────────────────────────────────────────────────────

const STATUSES: Status[] = ['open', 'in_progress', 'waiting_on_user', 'resolved', 'closed']
const PRIORITIES: Priority[] = ['urgent', 'high', 'medium', 'low']
const CATEGORIES: Category[] = [
  'account', 'payment', 'billing', 'campaign', 'feedback', 'technical',
  'feature_request', 'bug_report', 'influencer', 'deals', 'community',
  'competitive_intel', 'other',
]

function priorityClass(p: Priority): string {
  return {
    urgent: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
    high: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300',
    medium: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
    low: 'bg-gray-100 text-gray-600 dark:bg-gray-900 dark:text-gray-400',
  }[p]
}

function statusClass(s: Status): string {
  return {
    open: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
    in_progress: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300',
    waiting_on_user: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300',
    resolved: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
    closed: 'bg-gray-100 text-gray-600 dark:bg-gray-900 dark:text-gray-400',
  }[s]
}

function statusLabel(s: Status): string {
  return { open: 'Open', in_progress: 'In progress', waiting_on_user: 'Awaiting user', resolved: 'Resolved', closed: 'Closed' }[s]
}

// ── Page ───────────────────────────────────────────────────────────

export default function AdminTicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const { data: session, status: sessionStatus } = useSession()
  const role = (session?.user as any)?.role as string | undefined

  const [ticket, setTicket] = useState<AdminTicket | null>(null)
  const [messages, setMessages] = useState<TicketMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const [internalMode, setInternalMode] = useState(false)

  const [resolutionDraft, setResolutionDraft] = useState('')
  const [savingTriage, setSavingTriage] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/support/tickets/${id}`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Could not load ticket')
        return
      }
      const data = await res.json()
      setTicket(data.ticket)
      setMessages(data.messages ?? [])
      setResolutionDraft(data.ticket?.resolutionNotes ?? '')
    } catch (err) {
      console.error('[admin ticket detail] load failed:', err)
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    if (role === 'admin') load()
  }, [role, load])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  const sendReply = async (asInternal: boolean) => {
    if (!reply.trim() || sending) return
    setSending(true)
    try {
      const res = await apiPost(`/api/admin/support/tickets/${id}/reply`, {
        message: reply.trim(),
        isInternalNote: asInternal,
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || 'Could not send')
        return
      }
      const data = await res.json()
      setMessages((m) => [...m, data.message])
      setTicket((t) => (t ? { ...t, status: data.ticket.status, updatedAt: data.ticket.updatedAt } : t))
      setReply('')
      setInternalMode(false)
      toast.success(asInternal ? 'Internal note added' : 'Reply sent to user')
    } catch (err) {
      console.error('[admin ticket detail] reply failed:', err)
      toast.error('Network error')
    } finally {
      setSending(false)
    }
  }

  const updateTriage = async (patch: Partial<Pick<AdminTicket, 'status' | 'priority' | 'category'>> & { resolutionNotes?: string }) => {
    if (savingTriage) return
    setSavingTriage(true)
    try {
      const res = await apiPut(`/api/admin/support/tickets/${id}`, patch)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || 'Could not update ticket')
        return
      }
      const data = await res.json()
      setTicket(data.ticket)
      toast.success('Updated')
    } catch (err) {
      console.error('[admin ticket detail] update failed:', err)
      toast.error('Network error')
    } finally {
      setSavingTriage(false)
    }
  }

  // ── Auth gates ────────────────────────────────────────────────
  if (sessionStatus === 'loading') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }
  if (sessionStatus === 'unauthenticated' || role !== 'admin') {
    return (
      <div className="mx-auto mt-12 max-w-md rounded-xl border border-border bg-card p-6 text-center">
        <ShieldAlert className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
        <h2 className="text-base font-semibold">Admin access only</h2>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl p-4 md:p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Skeleton className="h-[400px] w-full lg:col-span-2" />
          <Skeleton className="h-[400px] w-full" />
        </div>
      </div>
    )
  }

  if (error || !ticket) {
    return (
      <div className="mx-auto max-w-md p-6 text-center">
        <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{error || 'Ticket not found'}</p>
        <Button variant="outline" size="sm" className="mt-3" asChild>
          <Link href="/admin/support">
            <ChevronLeft className="mr-1 h-3.5 w-3.5" /> Back to queue
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Button asChild variant="ghost" size="icon" className="shrink-0">
            <Link href="/admin/support" aria-label="Back to queue">
              <ChevronLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-muted-foreground">{ticket.ticketNumber}</span>
              <span className={'rounded-full px-2 py-0.5 text-[10px] font-medium ' + statusClass(ticket.status)}>
                {statusLabel(ticket.status)}
              </span>
              <span className={'rounded-full px-2 py-0.5 text-[10px] font-medium ' + priorityClass(ticket.priority)}>
                {ticket.priority}
              </span>
            </div>
            <h1 className="truncate text-lg font-semibold md:text-xl">{ticket.subject}</h1>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Thread + reply */}
        <Card className="lg:col-span-2">
          <CardHeader className="border-b border-border pb-3">
            <CardTitle className="text-sm">Conversation</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div ref={scrollRef} className="max-h-[60vh] space-y-3 overflow-y-auto p-4">
              {messages.map((m) => (
                <MessageRow key={m.id} m={m} />
              ))}
            </div>

            {/* Reply area */}
            <div className="border-t border-border bg-muted/20 p-3">
              <Textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder={internalMode ? 'Add an internal note (hidden from user)…' : 'Reply to user…'}
                disabled={sending}
                rows={3}
                className="text-sm"
              />
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <label className="flex items-center gap-1.5 text-xs">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5"
                    checked={internalMode}
                    onChange={(e) => setInternalMode(e.target.checked)}
                  />
                  <StickyNote className="h-3.5 w-3.5 text-amber-600" />
                  Internal note (admin only)
                </label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => sendReply(internalMode)}
                    disabled={!reply.trim() || sending}
                  >
                    {sending ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Send className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    {internalMode ? 'Add note' : 'Send reply'}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* User card */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <UserIcon className="h-4 w-4" /> User
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 text-xs">
              <Row label="Email" value={ticket.userEmail} />
              <Row label="Role" value={ticket.userRole} />
              <Row label="User ID" value={<span className="font-mono">{ticket.userId.slice(0, 12)}…</span>} />
              <Row label="Created" value={new Date(ticket.createdAt).toLocaleString()} />
              <Row label="Updated" value={new Date(ticket.updatedAt).toLocaleString()} />
              {ticket.resolvedAt && <Row label="Resolved" value={new Date(ticket.resolvedAt).toLocaleString()} />}
              {ticket.closedAt && <Row label="Closed" value={new Date(ticket.closedAt).toLocaleString()} />}
              {ticket.assignedTo && <Row label="Assigned" value={<span className="font-mono">{ticket.assignedTo.slice(0, 12)}…</span>} />}
            </CardContent>
          </Card>

          {/* Triage */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Triage</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5 text-xs">
              <div className="space-y-1">
                <label className="text-muted-foreground">Status</label>
                <Select
                  value={ticket.status}
                  onValueChange={(v) => updateTriage({ status: v as Status })}
                  disabled={savingTriage}
                >
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>{statusLabel(s)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-muted-foreground">Priority</label>
                <Select
                  value={ticket.priority}
                  onValueChange={(v) => updateTriage({ priority: v as Priority })}
                  disabled={savingTriage}
                >
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-muted-foreground">Category</label>
                <Select
                  value={ticket.category}
                  onValueChange={(v) => updateTriage({ category: v })}
                  disabled={savingTriage}
                >
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>{c.replace(/_/g, ' ')}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-muted-foreground">Resolution notes</label>
                <Textarea
                  rows={3}
                  value={resolutionDraft}
                  onChange={(e) => setResolutionDraft(e.target.value)}
                  placeholder="Visible to user when ticket is resolved"
                  className="text-xs"
                />
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  size="sm"
                  className="flex-1"
                  disabled={savingTriage || ticket.status === 'resolved'}
                  onClick={() => updateTriage({ status: 'resolved', resolutionNotes: resolutionDraft || undefined })}
                >
                  Resolve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  disabled={savingTriage || ticket.status === 'closed'}
                  onClick={() => updateTriage({ status: 'closed' })}
                >
                  Close
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Satisfaction */}
          {ticket.satisfactionRating != null && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Satisfaction</CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-1.5">
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star
                      key={n}
                      className={
                        'h-4 w-4 ' +
                        (n <= ticket.satisfactionRating!
                          ? 'fill-yellow-400 text-yellow-400'
                          : 'text-muted-foreground')
                      }
                    />
                  ))}
                  <span className="ml-1 text-muted-foreground">({ticket.satisfactionRating}/5)</span>
                </div>
                {ticket.satisfactionFeedback && (
                  <p className="rounded-md border border-border bg-card p-2 italic">
                    &ldquo;{ticket.satisfactionFeedback}&rdquo;
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Subcomponents ─────────────────────────────────────────────────

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate text-right">{value}</span>
    </div>
  )
}

function MessageRow({ m }: { m: TicketMessage }) {
  // Internal notes: yellow callout, regardless of sender (always admin in practice).
  if (m.isInternalNote) {
    return (
      <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 dark:border-amber-700 dark:bg-amber-950/30">
        <div className="mb-1 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-amber-700 dark:text-amber-300">
          <StickyNote className="h-3 w-3" />
          Internal note — not visible to user
        </div>
        <div className="text-sm text-amber-900 whitespace-pre-wrap dark:text-amber-100">{m.message}</div>
        <div className="mt-1 text-[10px] text-amber-700/70 dark:text-amber-300/70">
          {new Date(m.createdAt).toLocaleString()}
        </div>
      </div>
    )
  }

  if (m.senderType === 'system') {
    return (
      <div className="flex justify-center">
        <div className="text-[11px] italic text-muted-foreground">{m.message}</div>
      </div>
    )
  }

  // Admin replies → right side (admin POV); user/AI → left side
  const isAdmin = m.senderType === 'admin'
  const isAi = m.senderType === 'ai'

  return (
    <div className={'flex ' + (isAdmin ? 'justify-end' : 'justify-start')}>
      <div className={'max-w-[80%] rounded-2xl px-3.5 py-2 ' + (isAdmin ? 'rounded-br-sm bg-primary text-primary-foreground' : 'rounded-bl-sm bg-muted text-foreground')}>
        {!isAdmin && (
          <div className="mb-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
            {isAi ? 'AI assistant' : 'User'}
          </div>
        )}
        {isAdmin ? (
          <p className="text-sm whitespace-pre-wrap">{m.message}</p>
        ) : (
          <ChatMarkdown text={m.message} />
        )}
        <div className={'mt-1 text-[10px] ' + (isAdmin ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
          {new Date(m.createdAt).toLocaleString()}
        </div>
      </div>
    </div>
  )
}
