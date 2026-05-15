'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Plus, Ticket as TicketIcon } from 'lucide-react'
import { toast } from 'sonner'
import { apiPost } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { TicketDetail } from './TicketDetail'
import { CreateTicketForm } from './CreateTicketForm'

export type TicketSummary = {
  id: string
  ticketNumber: string
  subject: string
  category: string
  status: 'open' | 'in_progress' | 'waiting_on_user' | 'resolved' | 'closed'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  createdAt: string
  updatedAt: string
  satisfactionRating: number | null
}

export function statusBadgeClass(status: TicketSummary['status']): string {
  switch (status) {
    case 'open':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
    case 'in_progress':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300'
    case 'waiting_on_user':
      return 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300'
    case 'resolved':
      return 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300'
    case 'closed':
      return 'bg-gray-100 text-gray-600 dark:bg-gray-900 dark:text-gray-400'
  }
}

export function statusLabel(status: TicketSummary['status']): string {
  return {
    open: 'Open',
    in_progress: 'In progress',
    waiting_on_user: 'Awaiting you',
    resolved: 'Resolved',
    closed: 'Closed',
  }[status]
}

type View = { kind: 'list' } | { kind: 'detail'; id: string } | { kind: 'create' }

export function TicketTab() {
  const [view, setView] = useState<View>({ kind: 'list' })
  const [tickets, setTickets] = useState<TicketSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/support/tickets?limit=50')
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Could not load tickets')
        return
      }
      const data = await res.json()
      setTickets(data.tickets ?? [])
    } catch (err) {
      console.error('[TicketTab] load failed:', err)
      setError('Network error — please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (view.kind === 'list') load()
  }, [view.kind, load])

  if (view.kind === 'detail') {
    return (
      <TicketDetail
        ticketId={view.id}
        onBack={() => setView({ kind: 'list' })}
      />
    )
  }

  if (view.kind === 'create') {
    return (
      <CreateTicketForm
        onCancel={() => setView({ kind: 'list' })}
        onCreated={(t) => {
          toast.success(`Ticket ${t.ticketNumber} created`)
          setView({ kind: 'detail', id: t.id })
        }}
      />
    )
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
        <h3 className="text-sm font-semibold">My Tickets</h3>
        <Button size="sm" className="gap-1.5" onClick={() => setView({ kind: 'create' })}>
          <Plus className="h-3.5 w-3.5" />
          New
        </Button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {loading && (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        )}

        {!loading && error && (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button size="sm" variant="outline" onClick={load}>
              Try again
            </Button>
          </div>
        )}

        {!loading && !error && tickets.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
            <TicketIcon className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">No tickets yet</p>
            <p className="text-xs text-muted-foreground">
              Open a ticket and our team will respond within 24 hours.
            </p>
            <Button size="sm" className="mt-1 gap-1.5" onClick={() => setView({ kind: 'create' })}>
              <Plus className="h-3.5 w-3.5" />
              Create your first ticket
            </Button>
          </div>
        )}

        {!loading && !error && tickets.length > 0 && (
          <ul className="space-y-1.5">
            {tickets.map((t) => (
              <li key={t.id}>
                <button
                  onClick={() => setView({ kind: 'detail', id: t.id })}
                  className="flex w-full flex-col gap-1 rounded-md border border-border bg-card px-3 py-2.5 text-left hover:bg-accent/40 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {t.ticketNumber}
                    </span>
                    <span
                      className={
                        'rounded-full px-2 py-0.5 text-[10px] font-medium ' + statusBadgeClass(t.status)
                      }
                    >
                      {statusLabel(t.status)}
                    </span>
                  </div>
                  <span className="block text-sm font-medium text-foreground line-clamp-2">
                    {t.subject}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {new Date(t.updatedAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                    {' · '}
                    {t.category.replace(/_/g, ' ')}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export { TicketDetail }
