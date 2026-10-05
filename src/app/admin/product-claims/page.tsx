'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Loader2, AlertTriangle } from 'lucide-react'
import { apiPatch } from '@/lib/api-client'

/**
 * Product claim queue — admin.
 *
 * ⚠️ APPROVAL IS WHAT MOVES OWNERSHIP. The request moved nothing. Approving runs
 * `claimProduct()` inside the service's transaction, which also re-keys the
 * dual-key `brand_id` tables — so a failure rolls BOTH back and the request stays
 * open rather than being marked approved for a product it never got.
 *
 * ⚠️ REJECTION FREES THE PRODUCT. 044's partial unique index only blocks
 * `pending` and `info_requested`, so a rejected product becomes claimable by a
 * different brand — including a competitor. That is deliberate (a rejection must
 * not lock a product forever) and the copy says so, because an admin rejecting on
 * a hunch should know what they are opening up.
 */

type ClaimRequest = {
  id: string
  productId: string
  productName: string | null
  requesterEmail: string | null
  requesterName: string | null
  evidence: string | null
  status: string
  reviewNote: string | null
  reviewedAt: string | null
  createdAt: string
}

export default function AdminProductClaimsPage() {
  const [requests, setRequests] = useState<ClaimRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showDecided, setShowDecided] = useState(false)

  const [acting, setActing] = useState<{ req: ClaimRequest; action: 'approve' | 'reject' } | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const qs = showDecided ? '?status=pending,info_requested,approved,rejected' : ''
      const res = await fetch(`/api/admin/product-claims${qs}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to load claim requests')
      setRequests(data.requests ?? [])
    } catch (e: any) {
      setError(e?.message || 'Failed to load claim requests')
      setRequests([])
    } finally {
      setLoading(false)
    }
  }, [showDecided])

  useEffect(() => { void load() }, [load])

  const decide = async () => {
    if (!acting) return
    setBusy(true)
    setActionError(null)
    try {
      const res = await apiPatch(`/api/admin/product-claims/${acting.req.id}`, {
        action: acting.action,
        reviewNote: note.trim() || undefined,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to record the decision')
      setActing(null)
      setNote('')
      await load()
    } catch (e: any) {
      setActionError(e?.message || 'Failed to record the decision')
    } finally {
      setBusy(false)
    }
  }

  const open = requests.filter((r) => r.status === 'pending' || r.status === 'info_requested')

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Product claims</h1>
          <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
            Brands asking to own consumer-created products. Approving transfers
            ownership and gives them access to the feedback on that product.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowDecided((v) => !v)}>
          {showDecided ? 'Show open only' : 'Show all'}
        </Button>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      )}

      {error && (
        <Card className="border-red-700 bg-red-900/40">
          <CardContent className="pt-6 text-sm text-red-100">{error}</CardContent>
        </Card>
      )}

      {!loading && !error && requests.length === 0 && (
        <Card className="border-border bg-background/40">
          <CardContent className="pt-6 text-center text-sm text-muted-foreground">
            No {showDecided ? '' : 'open '}claim requests.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3">
        {requests.map((r) => {
          const isOpen = r.status === 'pending' || r.status === 'info_requested'
          return (
            <Card key={r.id} className="border-border bg-background/40">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <CardTitle className="truncate text-base">
                      {r.productName ?? '(product deleted)'}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {r.requesterName ? `${r.requesterName} · ` : ''}
                      {r.requesterEmail ?? 'unknown requester'}
                    </CardDescription>
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      r.status === 'approved' ? 'border-green-700 text-green-300'
                      : r.status === 'rejected' ? 'border-red-700 text-red-300'
                      : 'border-amber-700 text-amber-300'
                    }
                  >
                    {r.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                <div className="rounded-md bg-muted p-3">
                  <p className="text-xs font-medium text-muted-foreground">Their evidence</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm">
                    {r.evidence || <span className="text-muted-foreground">(none supplied)</span>}
                  </p>
                </div>

                {r.reviewNote && (
                  <p className="text-xs text-muted-foreground">
                    Review note: {r.reviewNote}
                  </p>
                )}

                {isOpen && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => { setActing({ req: r, action: 'approve' }); setNote(''); setActionError(null) }}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { setActing({ req: r, action: 'reject' }); setNote(''); setActionError(null) }}
                    >
                      Reject
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {!loading && open.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {open.length} awaiting a decision.
        </p>
      )}

      <Dialog open={!!acting} onOpenChange={(o) => !o && setActing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {acting?.action === 'approve' ? 'Approve' : 'Reject'} claim on “
              {acting?.req.productName ?? 'this product'}”
            </DialogTitle>
            <DialogDescription>
              {acting?.action === 'approve'
                ? 'Ownership transfers to this brand, and they gain access to the feedback on this product. Brand-keyed records move with it, in one transaction.'
                : 'The request is closed and the product becomes claimable again — by any brand, including a competitor. Rejection does not lock it.'}
            </DialogDescription>
          </DialogHeader>

          {acting?.action === 'reject' && (
            <div className="flex items-start gap-2 rounded-md border border-amber-700 bg-amber-900/30 p-3 text-xs text-amber-100">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                If this brand is the real owner, rejecting opens their product to
                whoever claims it next. Prefer asking for more evidence over
                rejecting on a hunch.
              </span>
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="review-note" className="text-sm font-medium">
              Note (optional)
            </label>
            <Textarea
              id="review-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Why you approved or rejected this."
            />
          </div>

          {actionError && <p className="text-sm text-red-300">{actionError}</p>}

          <DialogFooter>
            <Button variant="outline" onClick={() => setActing(null)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={decide} disabled={busy}>
              {busy ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…
                </>
              ) : acting?.action === 'approve' ? 'Approve claim' : 'Reject claim'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
