'use client'

import type { AdminPayoutRequestRow } from '@/lib/api-types/payout-requests'
import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Loader2, RefreshCw, Clock, CheckCircle, XCircle,
  AlertTriangle, IndianRupee, Wallet, User,
} from 'lucide-react'
import { toast } from 'sonner'
import { apiPost } from '@/lib/api-client'

/**
 * Admin queue for consumer payout requests.
 *
 * ⚠️ This table previously had NO admin surface. /admin/payouts reads
 * `influencer_payouts` — a DIFFERENT table — so consumer requests were
 * invisible to everyone who could act on them, with points already deducted.
 *
 * ⚠️ "Mark Paid" DOES NOT SEND MONEY. Every payout here is a manual bank/UPI
 * transfer made by a human; this records that it happened, with a reference.
 * The UI says so explicitly, because a button that looks like it pays someone
 * and does not is the false-affordance pattern this codebase keeps removing.
 */

// Shared with the route, which annotates the same type — the OUTER shape
// cannot drift, and the account fields are masked by construction.
type PayoutRequest = AdminPayoutRequestRow

function accountLabel(acc: PayoutRequest['account']): string | null {
  if (!acc) return null
  switch (acc.accountType) {
    case 'upi':
      return `UPI: ${acc.upiId ?? '—'}`
    case 'bank_account':
      return [acc.bankName, acc.accountNumberMasked].filter(Boolean).join(' ') || 'Bank account'
    default:
      return acc.accountType
  }
}

function StatusBadge({ status }: { status: PayoutRequest['status'] }) {
  switch (status) {
    case 'pending':
      return <Badge variant="outline" className="border-amber-700 text-amber-400"><Clock className="mr-1 h-3 w-3" />Pending</Badge>
    case 'approved':
      return <Badge variant="outline" className="border-blue-700 text-blue-400"><CheckCircle className="mr-1 h-3 w-3" />Approved — not yet paid</Badge>
    case 'paid':
      return <Badge variant="outline" className="border-emerald-700 text-emerald-400"><CheckCircle className="mr-1 h-3 w-3" />Paid</Badge>
    case 'denied':
      return <Badge variant="outline" className="border-red-800 text-red-400"><XCircle className="mr-1 h-3 w-3" />Denied</Badge>
  }
}

export default function AdminPayoutRequestsPage() {
  const { data: session, status: sessionStatus } = useSession()
  const router = useRouter()

  const [requests, setRequests] = useState<PayoutRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const [payTarget, setPayTarget] = useState<PayoutRequest | null>(null)
  const [payReference, setPayReference] = useState('')
  const [denyTarget, setDenyTarget] = useState<PayoutRequest | null>(null)
  const [denyReason, setDenyReason] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/payout-requests/pending')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load')
      setRequests(data.requests || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load payout requests')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (sessionStatus === 'authenticated') {
      if ((session?.user as any)?.role !== 'admin') { router.push('/dashboard'); return }
      void load()
    } else if (sessionStatus === 'unauthenticated') {
      router.push('/login')
    }
  }, [sessionStatus, session, router, load])

  async function act(requestId: string, action: 'approve' | 'pay' | 'deny', extra: Record<string, unknown> = {}) {
    setBusy(requestId)
    try {
      const res = await apiPost('/api/admin/payout-requests/process', { requestId, action, ...extra })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Action failed')
      toast.success(
        action === 'approve' ? 'Approved — money has not moved yet'
          : action === 'pay' ? 'Recorded as paid'
          : 'Denied and points refunded',
      )
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setBusy(null)
      setPayTarget(null); setPayReference('')
      setDenyTarget(null); setDenyReason('')
    }
  }

  if (sessionStatus === 'loading' || loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  const open = requests.filter((r) => r.status === 'pending' || r.status === 'approved')
  const history = requests.filter((r) => r.status === 'paid' || r.status === 'denied')
  const openTotal = open.reduce((sum, r) => sum + Number(r.amount || 0), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Consumer Payout Requests</h1>
          <p className="text-muted-foreground">
            Points cashed out by consumers. Separate from the influencer Payout Queue.
          </p>
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={loading}>
          <RefreshCw className="mr-2 h-4 w-4" />Refresh
        </Button>
      </div>

      {/* ⚠️ Says plainly that nothing here sends money. An admin must not
          believe clicking a button transferred funds. */}
      <Card className="border-amber-800 bg-amber-950/40">
        <CardContent className="flex gap-3 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
          <div className="space-y-1 text-sm">
            <p className="font-medium text-amber-200">These buttons do not transfer money.</p>
            <p className="text-amber-200/80">
              Automatic payouts are not enabled. Send the transfer yourself via bank or UPI,
              then use <strong>Mark Paid</strong> and enter the transaction reference so the
              record matches what actually happened.
            </p>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card><CardContent className="space-y-3 p-6 text-center">
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" onClick={() => void load()}>Try Again</Button>
        </CardContent></Card>
      )}

      <Card className="border-slate-700 bg-slate-900/50">
        <CardContent className="flex items-center justify-between p-4">
          <span className="text-sm text-muted-foreground">Open requests</span>
          <span className="flex items-center gap-4">
            <span className="text-sm">{open.length} request{open.length === 1 ? '' : 's'}</span>
            <span className="flex items-center text-lg font-semibold">
              <IndianRupee className="h-4 w-4" />{openTotal.toFixed(2)}
            </span>
          </span>
        </CardContent>
      </Card>

      {open.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">
          No open payout requests.
        </CardContent></Card>
      ) : (
        open.map((r) => (
          <Card key={r.id}>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2 text-base">
                  <User className="h-4 w-4" />
                  {r.userName || r.userEmail || (r.userId ? 'Unknown user' : 'Deleted account')}
                </CardTitle>
                {r.userEmail && <p className="text-xs text-muted-foreground">{r.userEmail}</p>}
              </div>
              <StatusBadge status={r.status} />
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <p className="text-xs text-muted-foreground">Amount</p>
                  <p className="flex items-center font-medium"><IndianRupee className="h-3.5 w-3.5" />{r.amount}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Points</p>
                  <p className="font-medium">{r.points.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Requested</p>
                  <p className="font-medium">{new Date(r.requestedAt).toLocaleDateString()}</p>
                </div>
              </div>

              <div className="rounded-md bg-background/40 p-3">
                <p className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Wallet className="h-3.5 w-3.5" />Send to
                </p>
                {accountLabel(r.account) ? (
                  <>
                    <p className="text-sm font-medium">{accountLabel(r.account)}</p>
                    {r.account?.accountHolderName && (
                      <p className="text-xs text-muted-foreground">{r.account.accountHolderName}</p>
                    )}
                  </>
                ) : (
                  // Not an edge case to hide — you cannot pay without this.
                  <p className="text-sm text-amber-400">
                    No payout account on file — ask the consumer to add one before paying.
                  </p>
                )}
              </div>

              {r.note && <p className="text-xs text-muted-foreground">Note: {r.note}</p>}

              <div className="flex flex-wrap gap-2">
                {r.status === 'pending' && (
                  <Button variant="outline" disabled={busy === r.id}
                    onClick={() => void act(r.id, 'approve')}>
                    {busy === r.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Approve
                  </Button>
                )}
                {/* ⚠️ NOT disabled when the account is missing. This button
                    RECORDS a payment you already made; it does not send one.
                    Gating it on an account on file prevented logging a
                    transfer arranged out-of-band (over email, a different
                    channel) — which blocks the record from matching reality,
                    the exact failure this queue exists to fix. The account is
                    guidance for WHERE to send, not a precondition for having
                    sent. The required transaction reference is the real
                    control. */}
                <Button disabled={busy === r.id}
                  onClick={() => { setPayTarget(r); setPayReference('') }}>
                  Mark Paid
                </Button>
                <Button variant="outline" className="border-red-800 text-red-400"
                  disabled={busy === r.id}
                  onClick={() => { setDenyTarget(r); setDenyReason('') }}>
                  Deny &amp; refund
                </Button>
              </div>
            </CardContent>
          </Card>
        ))
      )}

      {history.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">Recent history</h2>
          {history.map((r) => (
            <Card key={r.id} className="bg-background/40">
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
                <span>{r.userName || r.userEmail || 'Deleted account'}</span>
                <span className="flex items-center"><IndianRupee className="h-3.5 w-3.5" />{r.amount}</span>
                {r.paymentReference && (
                  <span className="text-xs text-muted-foreground">Ref: {r.paymentReference}</span>
                )}
                <StatusBadge status={r.status} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Mark Paid — reference is required, because "paid" with no reference is
          an unfalsifiable claim nobody can later confirm. */}
      <Dialog open={!!payTarget} onOpenChange={(o) => !o && setPayTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record this payout as paid</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Confirm you have already sent{' '}
              <strong className="text-foreground">₹{payTarget?.amount}</strong> to{' '}
              <strong className="text-foreground">{accountLabel(payTarget?.account ?? null) ?? 'this consumer'}</strong>.
              This records the payment; it does not send it.
            </p>
            {/* Says why there is no account rather than blocking — an
                out-of-band transfer is legitimate and must still be loggable. */}
            {!payTarget?.account && (
              <p className="rounded-md border border-amber-800 bg-amber-950/40 p-2.5 text-xs text-amber-200">
                No payout account is on file for this consumer. Only record this if you
                arranged the transfer another way — put that channel&apos;s reference below.
              </p>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="ref">Transaction reference <span className="text-red-400">*</span></Label>
              <Input id="ref" value={payReference} placeholder="UTR / UPI transaction id"
                onChange={(e) => setPayReference(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayTarget(null)}>Cancel</Button>
            <Button disabled={!payReference.trim() || busy === payTarget?.id}
              onClick={() => payTarget && void act(payTarget.id, 'pay', { paymentReference: payReference.trim() })}>
              {busy === payTarget?.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Record as paid
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!denyTarget} onOpenChange={(o) => !o && setDenyTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Deny and refund points</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {denyTarget?.points.toLocaleString()} points will be refunded to the consumer&apos;s balance.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="reason">Reason <span className="text-red-400">*</span></Label>
              <Input id="reason" value={denyReason} placeholder="Shown to the consumer"
                onChange={(e) => setDenyReason(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDenyTarget(null)}>Cancel</Button>
            <Button className="bg-red-900 hover:bg-red-800"
              disabled={!denyReason.trim() || busy === denyTarget?.id}
              onClick={() => denyTarget && void act(denyTarget.id, 'deny', { reason: denyReason.trim() })}>
              {busy === denyTarget?.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Deny &amp; refund
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
