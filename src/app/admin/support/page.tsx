'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import {
  Search, RefreshCw, Loader2, ShieldAlert, MessagesSquare,
  Inbox, Timer, Bot, Star, ChevronRight,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { SupportAnalyticsCharts, type Analytics } from './SupportAnalyticsCharts'

// ── Types ──────────────────────────────────────────────────────────

type TicketStatus = 'open' | 'in_progress' | 'waiting_on_user' | 'resolved' | 'closed'
type TicketPriority = 'low' | 'medium' | 'high' | 'urgent'

type AdminTicket = {
  id: string
  ticketNumber: string
  userId: string
  userEmail: string
  userRole: string
  category: string
  subject: string
  status: TicketStatus
  priority: TicketPriority
  assignedTo: string | null
  createdAt: string
  updatedAt: string
  satisfactionRating: number | null
}

// ── Style helpers ─────────────────────────────────────────────────

function priorityClass(p: TicketPriority): string {
  return {
    urgent: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
    high: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300',
    medium: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
    low: 'bg-gray-100 text-gray-600 dark:bg-gray-900 dark:text-gray-400',
  }[p]
}

function statusClass(s: TicketStatus): string {
  return {
    open: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
    in_progress: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300',
    waiting_on_user: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300',
    resolved: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
    closed: 'bg-gray-100 text-gray-600 dark:bg-gray-900 dark:text-gray-400',
  }[s]
}

function statusLabel(s: TicketStatus): string {
  return {
    open: 'Open',
    in_progress: 'In progress',
    waiting_on_user: 'Awaiting user',
    resolved: 'Resolved',
    closed: 'Closed',
  }[s]
}

function ageBadge(createdAt: string): { label: string; cls: string } {
  const ms = Date.now() - new Date(createdAt).getTime()
  const hours = ms / (1000 * 60 * 60)
  if (hours < 24) {
    return {
      label: `${Math.max(0, Math.round(hours))}h`,
      cls: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
    }
  }
  const days = hours / 24
  if (days <= 3) {
    return {
      label: `${Math.round(days)}d`,
      cls: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300',
    }
  }
  return {
    label: `${Math.round(days)}d`,
    cls: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
  }
}

function fmtHours(h: number | null): string {
  if (h == null) return '—'
  if (h < 1) return `${Math.round(h * 60)}m`
  if (h < 24) return `${h.toFixed(1)}h`
  return `${(h / 24).toFixed(1)}d`
}

const CATEGORY_OPTIONS = [
  'account', 'payment', 'billing', 'campaign', 'feedback', 'technical',
  'feature_request', 'bug_report', 'influencer', 'deals', 'community',
  'competitive_intel', 'other',
]

// ── Page ───────────────────────────────────────────────────────────

export default function AdminSupportPage() {
  const { data: session, status: sessionStatus } = useSession()
  const role = (session?.user as any)?.role as string | undefined
  const router = useRouter()

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('open_in_progress')
  const [priorityFilter, setPriorityFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [search, setSearch] = useState('')

  // Data
  const [tickets, setTickets] = useState<AdminTicket[]>([])
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [loadingTickets, setLoadingTickets] = useState(true)
  const [loadingAnalytics, setLoadingAnalytics] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 25

  const fetchTickets = useCallback(async () => {
    setLoadingTickets(true)
    setError(null)
    try {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(page * PAGE_SIZE) })
      if (statusFilter && statusFilter !== 'all' && statusFilter !== 'open_in_progress') {
        params.set('status', statusFilter)
      }
      if (priorityFilter !== 'all') params.set('priority', priorityFilter)
      if (categoryFilter !== 'all') params.set('category', categoryFilter)
      const res = await fetch(`/api/admin/support/tickets?${params.toString()}`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Failed to load tickets')
        return
      }
      const data = await res.json()
      setTickets(data.tickets ?? [])
    } catch (err) {
      console.error('[admin/support] tickets fetch failed:', err)
      setError('Network error')
    } finally {
      setLoadingTickets(false)
    }
  }, [statusFilter, priorityFilter, categoryFilter, page])

  const fetchAnalytics = useCallback(async () => {
    setLoadingAnalytics(true)
    try {
      const res = await fetch('/api/admin/support/analytics?days=30')
      if (!res.ok) return
      const data = (await res.json()) as Analytics
      setAnalytics(data)
    } catch (err) {
      console.error('[admin/support] analytics fetch failed:', err)
    } finally {
      setLoadingAnalytics(false)
    }
  }, [])

  useEffect(() => {
    if (role === 'admin') {
      fetchTickets()
      fetchAnalytics()
    }
  }, [role, fetchTickets, fetchAnalytics])

  // Client-side filtering for role + search + the open_in_progress combo
  const visibleTickets = useMemo(() => {
    return tickets.filter((t) => {
      if (statusFilter === 'open_in_progress' && t.status !== 'open' && t.status !== 'in_progress') return false
      if (roleFilter !== 'all' && t.userRole !== roleFilter) return false
      if (search.trim()) {
        const q = search.trim().toLowerCase()
        if (
          !t.ticketNumber.toLowerCase().includes(q) &&
          !t.subject.toLowerCase().includes(q) &&
          !t.userEmail.toLowerCase().includes(q)
        ) {
          return false
        }
      }
      return true
    })
  }, [tickets, statusFilter, roleFilter, search])

  const openTicketsCount = useMemo(() => {
    if (!analytics) return null
    const o = analytics.openByStatus
    return (o.open ?? 0) + (o.in_progress ?? 0) + (o.waiting_on_user ?? 0)
  }, [analytics])

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
        <p className="mt-1 text-sm text-muted-foreground">
          You need an admin account to view the support dashboard.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Support Dashboard</h1>
          <p className="text-sm text-muted-foreground">Queue, analytics, and chat escalations.</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            fetchTickets()
            fetchAnalytics()
          }}
        >
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      {/* Analytics cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Open tickets"
          value={openTicketsCount != null ? String(openTicketsCount) : '—'}
          icon={<Inbox className="h-4 w-4" />}
          loading={loadingAnalytics}
        />
        <MetricCard
          label="Avg first response"
          value={fmtHours(analytics?.avgFirstResponseHours ?? null)}
          icon={<Timer className="h-4 w-4" />}
          loading={loadingAnalytics}
        />
        <MetricCard
          label="AI resolution rate"
          value={
            analytics
              ? `${Math.round(analytics.aiResolutionRate.rate * 100)}%`
              : '—'
          }
          sublabel={analytics ? `${analytics.aiResolutionRate.resolvedByAi}/${analytics.aiResolutionRate.started} chats` : undefined}
          icon={<Bot className="h-4 w-4" />}
          loading={loadingAnalytics}
        />
        <MetricCard
          label="Avg satisfaction"
          value={analytics?.satisfactionAvg != null ? `${analytics.satisfactionAvg.toFixed(2)} / 5` : '—'}
          icon={<Star className="h-4 w-4" />}
          loading={loadingAnalytics}
        />
      </div>

      {/* Queue */}
      <Card>
        <CardHeader className="border-b border-border pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">Ticket queue</CardTitle>
            <span className="text-xs text-muted-foreground">
              Showing {visibleTickets.length} of {tickets.length} on this page
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-4">
          {/* Filters */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0) }}>
              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="open_in_progress">Open + In progress</SelectItem>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in_progress">In progress</SelectItem>
                <SelectItem value="waiting_on_user">Awaiting user</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>

            <Select value={priorityFilter} onValueChange={(v) => { setPriorityFilter(v); setPage(0) }}>
              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Priority" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All priorities</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>

            <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setPage(0) }}>
              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {CATEGORY_OPTIONS.map((c) => (
                  <SelectItem key={c} value={c}>{c.replace(/_/g, ' ')}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="User role" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                <SelectItem value="brand">Brand</SelectItem>
                <SelectItem value="consumer">Consumer</SelectItem>
                <SelectItem value="influencer">Influencer</SelectItem>
              </SelectContent>
            </Select>

            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search ticket # / subject / email"
                className="h-9 pl-8 text-xs"
              />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs">
                <tr className="text-left text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Ticket</th>
                  <th className="px-3 py-2 font-medium">User</th>
                  <th className="px-3 py-2 font-medium">Subject</th>
                  <th className="px-3 py-2 font-medium">Category</th>
                  <th className="px-3 py-2 font-medium">Priority</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Age</th>
                  <th className="px-3 py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {loadingTickets ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-t border-border">
                      <td colSpan={8} className="px-3 py-2"><Skeleton className="h-6 w-full" /></td>
                    </tr>
                  ))
                ) : error ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-sm text-destructive">{error}</td>
                  </tr>
                ) : visibleTickets.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-sm text-muted-foreground">
                      No tickets match these filters.
                    </td>
                  </tr>
                ) : (
                  visibleTickets.map((t) => {
                    const age = ageBadge(t.createdAt)
                    return (
                      <tr
                        key={t.id}
                        onClick={() => router.push(`/admin/support/tickets/${t.id}`)}
                        className="cursor-pointer border-t border-border hover:bg-accent/40 transition-colors"
                      >
                        <td className="px-3 py-2 font-mono text-xs">{t.ticketNumber}</td>
                        <td className="px-3 py-2">
                          <div className="text-xs">{t.userEmail}</div>
                          <div className="text-[10px] uppercase text-muted-foreground">{t.userRole}</div>
                        </td>
                        <td className="px-3 py-2 max-w-[260px]">
                          <div className="truncate text-sm">{t.subject}</div>
                        </td>
                        <td className="px-3 py-2 text-xs capitalize">{t.category.replace(/_/g, ' ')}</td>
                        <td className="px-3 py-2">
                          <span className={'rounded-full px-2 py-0.5 text-[10px] font-medium ' + priorityClass(t.priority)}>
                            {t.priority}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <span className={'rounded-full px-2 py-0.5 text-[10px] font-medium ' + statusClass(t.status)}>
                            {statusLabel(t.status)}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <span className={'rounded-full px-2 py-0.5 text-[10px] font-medium ' + age.cls}>
                            {age.label}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <ChevronRight className="inline h-4 w-4 text-muted-foreground" />
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0 || loadingTickets}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              Previous
            </Button>
            <span className="text-xs text-muted-foreground">Page {page + 1}</span>
            <Button
              variant="outline"
              size="sm"
              disabled={loadingTickets || tickets.length < PAGE_SIZE}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recent escalations */}
      <Card>
        <CardHeader className="border-b border-border pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MessagesSquare className="h-4 w-4" />
            Recent chat escalations
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          {loadingAnalytics ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : !analytics || analytics.recentEscalations.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No chat escalations yet.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {analytics.recentEscalations.map((e) => (
                <li key={e.conversationId}>
                  <Link
                    href={`/admin/support/tickets/${e.ticketId}`}
                    className="group flex items-start gap-3 rounded-md border border-border bg-card px-3 py-2.5 hover:bg-accent/40 transition-colors"
                  >
                    <span className="font-mono text-[10px] text-muted-foreground shrink-0 pt-0.5">
                      {e.ticketNumber}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium line-clamp-1">{e.subject}</span>
                      <span className="block text-[11px] text-muted-foreground">
                        {e.userRole} · {e.totalMessages} chat messages · {new Date(e.escalatedAt).toLocaleString()}
                      </span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-foreground transition-colors" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Analytics charts */}
      <div className="space-y-2">
        <h2 className="text-base font-semibold">Trends ({analytics?.windowDays ?? 30}-day window)</h2>
        {analytics ? (
          <SupportAnalyticsCharts data={analytics} />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[260px] w-full rounded-xl" />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Subcomponents ─────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  sublabel,
  icon,
  loading,
}: {
  label: string
  value: string
  sublabel?: string
  icon: React.ReactNode
  loading?: boolean
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
          <span className="text-muted-foreground">{icon}</span>
        </div>
        {loading ? (
          <Skeleton className="mt-2 h-7 w-16" />
        ) : (
          <div className="mt-1 text-2xl font-bold">{value}</div>
        )}
        {sublabel && !loading && (
          <div className="mt-0.5 text-[11px] text-muted-foreground">{sublabel}</div>
        )}
      </CardContent>
    </Card>
  )
}
