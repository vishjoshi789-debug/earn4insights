'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Loader2, CheckCircle2, XCircle, Clock, ShieldCheck, ExternalLink,
  MessageSquare, AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'
import { apiPost } from '@/lib/api-client'

/**
 * A9.2 — Admin verification queue.
 *
 * Mirrors the /admin/payouts UX pattern: list of pending items with
 * status / age badges, click-to-open detail with full context, three
 * action dialogs (approve / reject / request-info) each with a notes
 * textarea. All mutations via apiPost (auto CSRF).
 *
 * Default filter: status=manual_review. Pass `?status=all` to see
 * full history.
 */

type CheckRow = { passed: boolean; value?: unknown; threshold?: unknown }
type ThresholdResult = {
  tier: 1 | 2 | 3
  autoDecision: 'approve' | 'reject' | 'review'
  checks: Record<string, CheckRow>
  failedChecks: string[]
  totalFollowers: number
  reason: string
}

interface QueueRow {
  id: string
  userId: string
  status: string
  applicationMessage: string | null
  brandContactNotes: string | null
  portfolioLinks: string[]
  thresholdCheckResult: ThresholdResult | null
  reviewNotes: string | null
  reviewedAt: string | null
  eligibleToReapplyAt: string | null
  createdAt: string
  updatedAt: string
  userEmail: string | null
  userName: string | null
  displayName: string | null
  profileImageUrl: string | null
  currentVerificationStatus: 'unverified' | 'pending' | 'verified' | null
}

function ageBadge(createdAt: string) {
  const ageMs = Date.now() - new Date(createdAt).getTime()
  const hours = ageMs / 3_600_000
  if (hours < 24) return <Badge className="bg-green-500/15 text-green-600 border-green-500/30 text-[10px]" variant="outline">&lt; 24h</Badge>
  if (hours < 72) return <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30 text-[10px]" variant="outline">{Math.floor(hours / 24)}d</Badge>
  return <Badge className="bg-red-500/15 text-red-600 border-red-500/30 text-[10px]" variant="outline">{Math.floor(hours / 24)}d — urgent</Badge>
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    manual_review: 'bg-blue-500/15 text-blue-600 border-blue-500/30',
    needs_info:    'bg-amber-500/15 text-amber-600 border-amber-500/30',
    approved:      'bg-green-500/15 text-green-600 border-green-500/30',
    rejected:      'bg-red-500/15 text-red-600 border-red-500/30',
    auto_approved: 'bg-green-500/15 text-green-600 border-green-500/30',
    auto_rejected: 'bg-red-500/15 text-red-600 border-red-500/30',
    pending:       'bg-muted text-muted-foreground border-border',
  }
  return <Badge variant="outline" className={map[status] ?? 'bg-muted text-muted-foreground border-border'}>{status.replace(/_/g, ' ')}</Badge>
}

// ── Action Dialogs ─────────────────────────────────────────────────

type Action = 'approve' | 'reject' | 'request-info'

function ActionDialog({
  row, action, open, onClose, onSuccess,
}: { row: QueueRow | null; action: Action; open: boolean; onClose: () => void; onSuccess: () => void }) {
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => { if (open) setNotes('') }, [open, action])

  const handleSubmit = async () => {
    if (!row) return
    if ((action === 'reject' || action === 'request-info') && notes.trim().length === 0) {
      toast.error('Notes are required for this action.')
      return
    }
    setSubmitting(true)
    try {
      const res = await apiPost(
        `/api/admin/verification-requests/${row.id}/${action}`,
        { reviewNotes: notes.trim() || undefined },
      )
      const body = await res.json().catch(() => ({} as { error?: string }))
      if (!res.ok) {
        toast.error(body?.error ?? `Failed (${res.status})`)
        return
      }
      const labels: Record<Action, string> = {
        'approve': 'Request approved — user notified',
        'reject': 'Request rejected — user notified with cooldown',
        'request-info': 'User notified — awaiting their reply',
      }
      toast.success(labels[action])
      onSuccess()
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  const titles: Record<Action, string> = {
    'approve': 'Approve verification',
    'reject': 'Reject verification',
    'request-info': 'Request more info from user',
  }
  const placeholders: Record<Action, string> = {
    'approve': 'Optional note shown to the user in their approval email',
    'reject': 'REQUIRED — explanation shown to the user with their 30-day cooldown',
    'request-info': 'REQUIRED — message asking what info you need',
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{titles[action]}</DialogTitle>
        </DialogHeader>
        {row && (
          <div className="space-y-3">
            <div className="text-sm">
              <p className="font-medium text-foreground">{row.displayName || row.userName || 'Unknown'}</p>
              <p className="text-xs text-muted-foreground">{row.userEmail}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reviewNotes">
                {action === 'approve' ? 'Notes (optional)' : 'Notes (required)'}
              </Label>
              <Textarea
                id="reviewNotes"
                value={notes}
                onChange={(e) => setNotes(e.target.value.slice(0, 1000))}
                placeholder={placeholders[action]}
                rows={4}
                maxLength={1000}
              />
              <p className="text-xs text-muted-foreground">{notes.length} / 1000</p>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            variant={action === 'reject' ? 'destructive' : 'default'}
          >
            {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Working…</> : titles[action]}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Detail panel ───────────────────────────────────────────────────

function DetailPanel({ row }: { row: QueueRow }) {
  const checks = row.thresholdCheckResult?.checks ?? {}
  const totalFollowers = row.thresholdCheckResult?.totalFollowers ?? 0
  return (
    <div className="space-y-3 border-l border-border pl-4">
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-wide">Evaluator note</p>
        <p className="text-sm text-foreground">{row.thresholdCheckResult?.reason ?? '—'}</p>
      </div>
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-wide">Total followers</p>
        <p className="text-sm font-semibold text-foreground">{totalFollowers.toLocaleString()}</p>
      </div>
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Threshold checks</p>
        <ul className="space-y-0.5">
          {Object.entries(checks).map(([k, r]) => (
            <li key={k} className="flex items-center gap-2 text-xs">
              {r.passed
                ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" aria-hidden="true" />
                : <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" aria-hidden="true" />}
              <span className="text-foreground">{k}</span>
              <span className="text-muted-foreground">— {String(r.value ?? '—')} / {String(r.threshold ?? '—')}</span>
            </li>
          ))}
        </ul>
      </div>
      {row.applicationMessage && (
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Application message</p>
          <p className="text-xs text-foreground whitespace-pre-wrap">{row.applicationMessage}</p>
        </div>
      )}
      {row.brandContactNotes && (
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Brand contact / referral</p>
          <p className="text-xs text-foreground whitespace-pre-wrap">{row.brandContactNotes}</p>
        </div>
      )}
      {row.portfolioLinks?.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Portfolio</p>
          <ul className="space-y-1">
            {row.portfolioLinks.map((url, i) => (
              <li key={i}>
                <a href={url} target="_blank" rel="noreferrer noopener" className="text-xs text-primary inline-flex items-center gap-1 underline underline-offset-2">
                  {url}
                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────

export default function VerificationRequestsAdminPage() {
  const [rows, setRows] = useState<QueueRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<'manual_review' | 'needs_info' | 'all'>('manual_review')
  const [actionTarget, setActionTarget] = useState<{ row: QueueRow; action: Action } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/verification-requests?status=${statusFilter}`, {
        credentials: 'same-origin',
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body?.error ?? `Failed to load (${res.status})`)
        setLoading(false)
        return
      }
      const json = await res.json() as { requests: QueueRow[] }
      setRows(json.requests ?? [])
      setLoading(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error')
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => { void load() }, [load])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-headline flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-primary" />
          Influencer verification queue
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manual-review requests await your decision. Approve, reject (with reason + 30-day cooldown), or ask for more info.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={statusFilter === 'manual_review' ? 'default' : 'outline'}
          onClick={() => setStatusFilter('manual_review')}
        >
          <Clock className="mr-1.5 h-3.5 w-3.5" />Awaiting review
        </Button>
        <Button
          size="sm"
          variant={statusFilter === 'needs_info' ? 'default' : 'outline'}
          onClick={() => setStatusFilter('needs_info')}
        >
          <MessageSquare className="mr-1.5 h-3.5 w-3.5" />Needs info
        </Button>
        <Button
          size="sm"
          variant={statusFilter === 'all' ? 'default' : 'outline'}
          onClick={() => setStatusFilter('all')}
        >
          All history
        </Button>
        <Button size="sm" variant="ghost" onClick={() => void load()}>
          <Loader2 className={`mr-1.5 h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />Refresh
        </Button>
      </div>

      {error && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start gap-2 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {loading && rows.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            {statusFilter === 'manual_review'
              ? 'No verification requests waiting for review. Nice.'
              : statusFilter === 'needs_info'
              ? 'No requests waiting on user info.'
              : 'No verification requests yet.'}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <Card key={row.id}>
              <CardHeader className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                <CardTitle className="text-base flex items-center gap-2">
                  {row.profileImageUrl ? (
                    <img src={row.profileImageUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
                  ) : (
                    <span className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs text-muted-foreground">
                      {(row.displayName || row.userName || row.userEmail || '?')[0]?.toUpperCase()}
                    </span>
                  )}
                  <span>
                    {row.displayName || row.userName || 'Unknown'}
                    <span className="block text-xs text-muted-foreground font-normal">{row.userEmail}</span>
                  </span>
                </CardTitle>
                <div className="flex items-center gap-2">
                  {ageBadge(row.createdAt)}
                  <StatusBadge status={row.status} />
                </div>
              </CardHeader>
              <CardContent className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4">
                <DetailPanel row={row} />
                {(row.status === 'manual_review' || row.status === 'needs_info') && (
                  <div className="flex flex-col gap-2 self-start min-w-[180px]">
                    <Button size="sm" onClick={() => setActionTarget({ row, action: 'approve' })}>
                      <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />Approve
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => setActionTarget({ row, action: 'reject' })}>
                      <XCircle className="mr-1.5 h-3.5 w-3.5" />Reject
                    </Button>
                    {row.status === 'manual_review' && (
                      <Button size="sm" variant="outline" onClick={() => setActionTarget({ row, action: 'request-info' })}>
                        <MessageSquare className="mr-1.5 h-3.5 w-3.5" />Request info
                      </Button>
                    )}
                  </div>
                )}
                {row.status !== 'manual_review' && row.status !== 'needs_info' && row.reviewNotes && (
                  <div className="self-start min-w-[180px] text-xs text-muted-foreground italic">
                    Reviewer note: &ldquo;{row.reviewNotes}&rdquo;
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ActionDialog
        row={actionTarget?.row ?? null}
        action={actionTarget?.action ?? 'approve'}
        open={actionTarget !== null}
        onClose={() => setActionTarget(null)}
        onSuccess={() => void load()}
      />
    </div>
  )
}
