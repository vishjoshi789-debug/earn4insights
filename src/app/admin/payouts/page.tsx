'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Loader2, RefreshCw, Clock, CheckCircle, XCircle,
  AlertTriangle, User, ShieldCheck, Wallet, IndianRupee,
  AlertCircle,
} from 'lucide-react'
import { toast } from 'sonner'

// ── Types ──────────────────────────────────────────────────────────

type PayoutStatus = 'pending' | 'processing' | 'completed' | 'failed'
type RecipientType = 'influencer' | 'consumer'

interface AdminPayout {
  id: string
  recipientId: string
  recipientName: string
  recipientEmail: string
  recipientType: RecipientType
  campaignId: string | null
  amount: number
  currency: string
  payoutMethod: string
  status: PayoutStatus
  accountDisplay: string | null
  retryCount: number
  failureReason: string | null
  adminNote: string | null
  createdAt: string
  initiatedAt: string | null
}

// ── Helpers ────────────────────────────────────────────────────────

function formatAmount(paise: number, currency: string): string {
  const major = paise / 100
  if (currency === 'INR') return `₹${major.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
  return `${currency} ${major.toFixed(2)}`
}

function ageBadge(createdAt: string) {
  const ageMs = Date.now() - new Date(createdAt).getTime()
  const hours = ageMs / 3_600_000
  if (hours < 24) return <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 text-[10px]">&lt; 24h</Badge>
  if (hours < 72) return <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300 text-[10px]">{Math.floor(hours / 24)}d</Badge>
  return <Badge className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 text-[10px]">{Math.floor(hours / 24)}d — urgent</Badge>
}

function StatusBadge({ status }: { status: PayoutStatus }) {
  const map: Record<PayoutStatus, string> = {
    pending:    'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
    processing: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
    completed:  'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
    failed:     'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  }
  return <Badge className={map[status]}>{status.charAt(0).toUpperCase() + status.slice(1)}</Badge>
}

function methodLabel(method: string): string {
  const labels: Record<string, string> = {
    razorpay_payout: 'Razorpay',
    wise_manual:     'Wise',
    paypal_manual:   'PayPal',
    bank_manual:     'Bank',
    upi_manual:      'UPI',
    manual:          'Manual',
  }
  return labels[method] ?? method
}

// ── Action Dialogs ─────────────────────────────────────────────────

function ProcessDialog({
  payout, open, onClose, onSuccess,
}: { payout: AdminPayout | null; open: boolean; onClose: () => void; onSuccess: () => void }) {
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!payout) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/payouts/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payoutId: payout.id, action: 'process', note: note || undefined }),
      })
      const data = await res.json()
      if (res.ok) { toast.success('Marked as processing'); onSuccess() }
      else throw new Error(data.error)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed')
    } finally {
      setSubmitting(false)
      setNote('')
    }
  }

  return (
    <Dialog open={open} onOpenChange={o => { if (!o && !submitting) { setNote(''); onClose() } }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Mark as Processing</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-sm text-muted-foreground">
            Recipient: <span className="font-medium text-foreground">{payout?.recipientName}</span>
            {' · '}{payout ? formatAmount(payout.amount, payout.currency) : ''}
          </p>
          <div className="space-y-1">
            <Label className="text-xs">Admin note (optional)</Label>
            <Input value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Transfer initiated via Wise" className="text-sm" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button size="sm" onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />}Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CompleteDialog({
  payout, open, onClose, onSuccess,
}: { payout: AdminPayout | null; open: boolean; onClose: () => void; onSuccess: () => void }) {
  const [ref, setRef] = useState('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!payout) return
    if (!ref.trim()) { toast.error('Transfer reference is required'); return }
    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/payouts/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payoutId: payout.id, action: 'complete', transferReference: ref, note: note || undefined }),
      })
      const data = await res.json()
      if (res.ok) { toast.success('Marked as completed'); onSuccess() }
      else throw new Error(data.error)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed')
    } finally {
      setSubmitting(false); setRef(''); setNote('')
    }
  }

  return (
    <Dialog open={open} onOpenChange={o => { if (!o && !submitting) { setRef(''); setNote(''); onClose() } }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Mark as Completed</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-sm text-muted-foreground">
            Recipient: <span className="font-medium text-foreground">{payout?.recipientName}</span>
            {' · '}{payout ? formatAmount(payout.amount, payout.currency) : ''}
          </p>
          <div className="space-y-1">
            <Label className="text-xs">Transfer reference <span className="text-red-500">*</span></Label>
            <Input value={ref} onChange={e => setRef(e.target.value)} placeholder="e.g. TXN123456 / UTR number" className="text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Admin note (optional)</Label>
            <Input value={note} onChange={e => setNote(e.target.value)} placeholder="Additional notes" className="text-sm" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />}Mark Complete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function FailDialog({
  payout, open, onClose, onSuccess,
}: { payout: AdminPayout | null; open: boolean; onClose: () => void; onSuccess: () => void }) {
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!payout) return
    if (!reason.trim()) { toast.error('Failure reason is required'); return }
    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/payouts/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payoutId: payout.id, action: 'fail', reason }),
      })
      const data = await res.json()
      if (res.ok) { toast.success('Marked as failed'); onSuccess() }
      else throw new Error(data.error)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed')
    } finally {
      setSubmitting(false); setReason('')
    }
  }

  return (
    <Dialog open={open} onOpenChange={o => { if (!o && !submitting) { setReason(''); onClose() } }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Mark as Failed</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-sm text-muted-foreground">
            Recipient: <span className="font-medium text-foreground">{payout?.recipientName}</span>
            {' · '}{payout ? formatAmount(payout.amount, payout.currency) : ''}
          </p>
          <div className="space-y-1">
            <Label className="text-xs">Failure reason <span className="text-red-500">*</span></Label>
            <Input value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Invalid account number" className="text-sm" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button size="sm" variant="destructive" onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />}Mark Failed
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Main Page ──────────────────────────────────────────────────────

export default function AdminPayoutsPage() {
  const { data: session, status: authStatus } = useSession()
  const router = useRouter()

  const [payouts, setPayouts]   = useState<AdminPayout[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)

  // Filters
  const [statusFilter, setStatusFilter]            = useState<string>('all')
  const [recipientFilter, setRecipientFilter]      = useState<string>('all')
  const [methodFilter, setMethodFilter]            = useState<string>('all')

  // Dialog state
  const [selectedPayout, setSelectedPayout]        = useState<AdminPayout | null>(null)
  const [processOpen, setProcessOpen]              = useState(false)
  const [completeOpen, setCompleteOpen]            = useState(false)
  const [failOpen, setFailOpen]                    = useState(false)
  const [retrying, setRetrying]                    = useState<string | null>(null)

  // Auth redirect
  useEffect(() => {
    if (authStatus === 'unauthenticated') router.replace('/login')
  }, [authStatus, router])

  const user = session?.user as any
  const isAdmin = user?.role === 'admin'

  const loadPayouts = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/payouts/pending')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load payouts')
      setPayouts(data.payouts || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load payouts')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isAdmin) void loadPayouts()
  }, [isAdmin, loadPayouts])

  const handleRetry = async (payout: AdminPayout) => {
    setRetrying(payout.id)
    try {
      const res = await fetch('/api/admin/payouts/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payoutId: payout.id, action: 'retry' }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success('Payout queued for retry')
        void loadPayouts()
      } else {
        throw new Error(data.error)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Retry failed')
    } finally {
      setRetrying(null)
    }
  }

  const onActionSuccess = () => {
    setProcessOpen(false)
    setCompleteOpen(false)
    setFailOpen(false)
    setSelectedPayout(null)
    void loadPayouts()
  }

  // ── Loading / Auth guards ────────────────────────────────────────
  if (authStatus === 'loading') {
    return (
      <div className="p-8 max-w-6xl mx-auto space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-4 gap-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="p-8 max-w-md mx-auto pt-20">
        <Card>
          <CardContent className="p-8 text-center space-y-3">
            <ShieldCheck className="h-10 w-10 mx-auto text-muted-foreground" />
            <p className="font-semibold">Admin access required</p>
            <p className="text-sm text-muted-foreground">You don't have permission to view this page.</p>
            <Button variant="outline" size="sm" onClick={() => router.replace('/dashboard')}>
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ── Stats ────────────────────────────────────────────────────────
  const pending    = payouts.filter(p => p.status === 'pending')
  const processing = payouts.filter(p => p.status === 'processing')
  const failed     = payouts.filter(p => p.status === 'failed')
  const totalPending = pending.reduce((s, p) => s + p.amount, 0)
  const totalProcessing = processing.reduce((s, p) => s + p.amount, 0)

  // ── Filtered rows ────────────────────────────────────────────────
  const filtered = payouts.filter(p => {
    if (statusFilter !== 'all' && p.status !== statusFilter) return false
    if (recipientFilter !== 'all' && p.recipientType !== recipientFilter) return false
    if (methodFilter !== 'all') {
      const method = methodLabel(p.payoutMethod).toLowerCase()
      if (!method.includes(methodFilter.toLowerCase())) return false
    }
    return true
  })

  const currencyFor = (ps: AdminPayout[]) => ps[0]?.currency ?? 'INR'

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Payout Queue</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage manual payout processing</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void loadPayouts()} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* ── Stats bar ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-amber-500" /> Pending
            </p>
            <p className="text-2xl font-bold mt-1">{pending.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{pending.length > 0 ? formatAmount(totalPending, currencyFor(pending)) : '—'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Loader2 className="h-3.5 w-3.5 text-blue-500" /> Processing
            </p>
            <p className="text-2xl font-bold mt-1">{processing.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{processing.length > 0 ? formatAmount(totalProcessing, currencyFor(processing)) : '—'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <XCircle className="h-3.5 w-3.5 text-red-500" /> Failed
            </p>
            <p className="text-2xl font-bold mt-1">{failed.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{failed.length > 0 ? 'Needs attention' : 'All clear'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Wallet className="h-3.5 w-3.5 text-indigo-500" /> Total in queue
            </p>
            <p className="text-2xl font-bold mt-1">{payouts.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">payouts</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 flex-wrap">
          {(['all', 'pending', 'processing', 'failed'] as const).map(s => (
            <Button
              key={s}
              size="sm"
              variant={statusFilter === s ? 'default' : 'outline'}
              className="h-7 text-xs"
              onClick={() => setStatusFilter(s)}
            >
              {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
              {s !== 'all' && (
                <span className="ml-1.5 bg-background/20 rounded-full px-1.5 py-0.5 text-[10px]">
                  {payouts.filter(p => p.status === s).length}
                </span>
              )}
            </Button>
          ))}
        </div>

        <div className="flex gap-2 ml-auto">
          <Select value={recipientFilter} onValueChange={setRecipientFilter}>
            <SelectTrigger className="h-7 w-36 text-xs bg-background text-foreground">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-background text-foreground">
              <SelectItem value="all">All recipients</SelectItem>
              <SelectItem value="influencer">Influencer</SelectItem>
              <SelectItem value="consumer">Consumer</SelectItem>
            </SelectContent>
          </Select>

          <Select value={methodFilter} onValueChange={setMethodFilter}>
            <SelectTrigger className="h-7 w-32 text-xs bg-background text-foreground">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-background text-foreground">
              <SelectItem value="all">All methods</SelectItem>
              <SelectItem value="wise">Wise</SelectItem>
              <SelectItem value="paypal">PayPal</SelectItem>
              <SelectItem value="bank">Bank</SelectItem>
              <SelectItem value="upi">UPI</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ── Table ── */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      ) : error ? (
        <Card>
          <CardContent className="p-8 text-center space-y-3">
            <AlertCircle className="h-8 w-8 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" size="sm" onClick={() => void loadPayouts()}>Try Again</Button>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center space-y-2">
            <CheckCircle className="h-10 w-10 mx-auto text-green-500" />
            <p className="font-medium">Queue is empty</p>
            <p className="text-sm text-muted-foreground">No payouts match the current filters.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground text-xs">
                  <th className="px-4 py-3 text-left font-medium">Recipient</th>
                  <th className="px-4 py-3 text-right font-medium">Amount</th>
                  <th className="px-4 py-3 text-left font-medium">Method</th>
                  <th className="px-4 py-3 text-left font-medium">Account</th>
                  <th className="px-4 py-3 text-left font-medium">Waiting</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map(p => (
                  <tr key={p.id} className="hover:bg-muted/30 transition-colors align-top">
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-2">
                        <User className="h-3.5 w-3.5 mt-0.5 text-muted-foreground flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate max-w-[140px]">{p.recipientName}</p>
                          <p className="text-[11px] text-muted-foreground truncate max-w-[140px]">{p.recipientEmail}</p>
                          <Badge variant="outline" className="text-[9px] h-3.5 mt-0.5 capitalize">{p.recipientType}</Badge>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-medium whitespace-nowrap">
                      {formatAmount(p.amount, p.currency)}
                    </td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap">{methodLabel(p.payoutMethod)}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground max-w-[180px]">
                      <span className="truncate block" title={p.accountDisplay ?? undefined}>
                        {p.accountDisplay ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">{ageBadge(p.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        <StatusBadge status={p.status} />
                        {p.failureReason && (
                          <p className="text-[10px] text-red-500 max-w-[120px] truncate" title={p.failureReason}>
                            {p.failureReason}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {p.status === 'pending' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 text-[11px] px-2"
                            onClick={() => { setSelectedPayout(p); setProcessOpen(true) }}
                          >
                            Mark Processing
                          </Button>
                        )}
                        {p.status === 'processing' && (
                          <Button
                            size="sm"
                            className="h-6 text-[11px] px-2 bg-green-600 hover:bg-green-700 text-white"
                            onClick={() => { setSelectedPayout(p); setCompleteOpen(true) }}
                          >
                            Mark Complete
                          </Button>
                        )}
                        {(p.status === 'pending' || p.status === 'processing') && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 text-[11px] px-2 text-red-600 border-red-200 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950"
                            onClick={() => { setSelectedPayout(p); setFailOpen(true) }}
                          >
                            Mark Failed
                          </Button>
                        )}
                        {p.status === 'failed' && p.retryCount < 3 && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 text-[11px] px-2"
                            disabled={retrying === p.id}
                            onClick={() => handleRetry(p)}
                          >
                            {retrying === p.id
                              ? <Loader2 className="h-3 w-3 animate-spin" />
                              : 'Retry'
                            }
                          </Button>
                        )}
                        {p.status === 'failed' && p.retryCount >= 3 && (
                          <span className="text-[10px] text-muted-foreground">Max retries reached</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* ── Action Dialogs ── */}
      <ProcessDialog
        payout={selectedPayout}
        open={processOpen}
        onClose={() => { setProcessOpen(false); setSelectedPayout(null) }}
        onSuccess={onActionSuccess}
      />
      <CompleteDialog
        payout={selectedPayout}
        open={completeOpen}
        onClose={() => { setCompleteOpen(false); setSelectedPayout(null) }}
        onSuccess={onActionSuccess}
      />
      <FailDialog
        payout={selectedPayout}
        open={failOpen}
        onClose={() => { setFailOpen(false); setSelectedPayout(null) }}
        onSuccess={onActionSuccess}
      />
    </div>
  )
}
