'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Search, Loader2, ShieldCheck, Info } from 'lucide-react'
import { apiPost } from '@/lib/api-client'

/**
 * Claim a product — brand-facing.
 *
 * SEARCH-AND-CONFIRM, not a discovery feed. A brand arrives looking for THEIR
 * OWN product; the feedback count is confirmation that they found the right
 * thing, not a ranking signal. (Every claimable product currently carries 1–2
 * feedback items, so a count column would read "Fewer than 5" on every row and
 * rank nothing.) An empty query lists everything, because the set is small and
 * an empty box that reveals nothing reads as a broken feature.
 *
 * ⚠️ A claim does NOT grant ownership. It creates a request an admin reviews.
 * The copy says so in both places a brand looks, because a brand who expects
 * instant access and gets silence will assume it failed.
 */

const MIN_EVIDENCE_LENGTH = 20

type OwnRequest = {
  status: 'pending' | 'approved' | 'rejected' | 'info_requested' | string
  /** ISO. Formatted for display at the point of use, never shown raw. */
  createdAt: string
}

type Claimable = {
  id: string
  name: string
  description: string | null
  created_at?: string
  /** null when below the cohort floor — never a raw sub-floor number. */
  feedbackCount: number | null
  feedbackCountBelowFloor: boolean
  /**
   * THIS brand's request on this product, or null if they've never asked.
   *
   * ⚠️ Always the viewer's own. The API deliberately sends nothing about
   * another brand's request — a product someone else has claimed still appears
   * here with an enabled control (Finding 2), and finding out costs a submit.
   * Excluding those is the agreed direction and is not built yet.
   */
  ownRequest: OwnRequest | null
}

/** "5 October" — a date a person reads, not an ISO timestamp. */
function formatSubmitted(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'recently'
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })
}

export default function ClaimProductPage() {
  const [query, setQuery] = useState('')
  const [products, setProducts] = useState<Claimable[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [minCohortSize, setMinCohortSize] = useState(5)

  const [selected, setSelected] = useState<Claimable | null>(null)
  const [evidence, setEvidence] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState<string[]>([])

  const load = useCallback(async (q: string) => {
    setLoading(true)
    setLoadError(null)
    try {
      const url = q.trim()
        ? `/api/dashboard/products/claimable?q=${encodeURIComponent(q.trim())}`
        : '/api/dashboard/products/claimable'
      const res = await fetch(url)
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to load claimable products')
      setProducts(data.products ?? [])
      if (typeof data.minCohortSize === 'number') setMinCohortSize(data.minCohortSize)
    } catch (e: any) {
      setLoadError(e?.message || 'Failed to load claimable products')
      setProducts([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => void load(query), query ? 300 : 0)
    return () => clearTimeout(t)
  }, [query, load])

  const submit = async () => {
    if (!selected) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const res = await apiPost('/api/dashboard/products/claim', {
        productId: selected.id,
        evidence,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to submit claim')
      setSubmitted((prev) => [...prev, selected.id])
      setSelected(null)
      setEvidence('')
    } catch (e: any) {
      setSubmitError(e?.message || 'Failed to submit claim')
    } finally {
      setSubmitting(false)
    }
  }

  const evidenceTooShort = evidence.trim().length < MIN_EVIDENCE_LENGTH

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Claim a product</h1>
        <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
          Consumers can add a product by name when they leave feedback, so your product
          may already be here with feedback waiting on it. Search for it and tell us
          it&apos;s yours.
        </p>
      </div>

      {/* Set the expectation before they click, not after. */}
      <div className="flex items-start gap-3 rounded-lg border border-indigo-700 bg-indigo-900/40 p-4">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-indigo-300" />
        <div className="text-sm">
          <p className="font-medium text-indigo-100">Claims are reviewed by an admin</p>
          <p className="mt-1 text-indigo-200/80">
            Submitting a claim doesn&apos;t transfer the product to you straight away. A
            consumer who left feedback expected it to reach the real brand, so we check
            before handing it over. You&apos;ll see the product in your dashboard once
            it&apos;s approved.
          </p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by product name…"
          className="pl-9"
          aria-label="Search claimable products by name"
        />
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      )}

      {loadError && (
        <Card className="border-red-700 bg-red-900/40">
          <CardContent className="pt-6 text-sm text-red-100">{loadError}</CardContent>
        </Card>
      )}

      {!loading && !loadError && products.length === 0 && (
        <Card className="border-border bg-background/40">
          <CardContent className="pt-6 text-center">
            <p className="text-sm text-muted-foreground">
              {query.trim()
                ? `No claimable products match “${query.trim()}”.`
                : 'There are no unclaimed products right now.'}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Products appear here when a consumer names one that isn&apos;t on the
              platform yet. If yours isn&apos;t listed, you can{' '}
              <Link href="/dashboard/launch" className="text-primary hover:underline">
                add it yourself
              </Link>
              .
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3">
        {products.map((p) => {
          // ⚠️ SERVER STATE FIRST, SESSION STATE ONLY AS A STOPGAP.
          //
          // `submitted` is what this browser tab did since load; `p.ownRequest`
          // is what the database says. The page used to know ONLY the former,
          // so a refresh re-enabled the button on a product the brand had
          // already claimed — they'd submit again and be refused. `ownRequest`
          // survives a refresh, a new tab, and a different device.
          //
          // `submitted` is kept purely so the card updates the instant a claim
          // succeeds, without refetching the list.
          const own = p.ownRequest
          const openFromServer = own?.status === 'pending' || own?.status === 'info_requested'
          const isPending = openFromServer || submitted.includes(p.id)
          // Honest, not hidden: a rejected brand sees that it was rejected.
          // They can still request again — that is Finding 4, unchanged here.
          const wasRejected = own?.status === 'rejected'
          return (
            <Card key={p.id} className="border-border bg-background/40">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <CardTitle className="truncate text-base">{p.name}</CardTitle>
                    {p.description && (
                      <CardDescription className="mt-1 line-clamp-2">
                        {p.description}
                      </CardDescription>
                    )}
                  </div>
                  {isPending ? (
                    <Badge
                      variant="outline"
                      className="shrink-0 border-amber-700 text-amber-300"
                    >
                      Request pending
                    </Badge>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => {
                        setSelected(p)
                        setEvidence('')
                        setSubmitError(null)
                      }}
                    >
                      {wasRejected ? 'Request again' : 'This is ours'}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                {/* ⚠️ Floored. Below MIN_COHORT_SIZE the API sends no number at all —
                    the claimant is still unverified here, so a raw low count would
                    leak what the floor exists to protect. */}
                <Badge variant="outline" className="border-border text-xs text-muted-foreground">
                  {p.feedbackCountBelowFloor
                    ? `Fewer than ${minCohortSize} feedback items`
                    : `${p.feedbackCount} feedback items`}
                </Badge>

                {openFromServer && own && (
                  <p className="text-xs text-amber-200/90">
                    You submitted this claim on {formatSubmitted(own.createdAt)}. An admin
                    is reviewing it — we&apos;ll let you know.
                  </p>
                )}

                {wasRejected && own && (
                  <p className="text-xs text-muted-foreground">
                    A previous claim of yours on this product was declined on{' '}
                    {formatSubmitted(own.createdAt)}. You can ask again with more detail.
                  </p>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Claim “{selected?.name}”</DialogTitle>
            <DialogDescription>
              {selected?.feedbackCountBelowFloor
                ? `This product has fewer than ${minCohortSize} feedback items.`
                : `This product has ${selected?.feedbackCount} feedback items.`}{' '}
              An admin reviews every claim before ownership moves.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <label htmlFor="claim-evidence" className="text-sm font-medium">
              Why is this product yours?
            </label>
            <Textarea
              id="claim-evidence"
              value={evidence}
              onChange={(e) => setEvidence(e.target.value)}
              rows={5}
              placeholder="Your role at the company, the product's website, anything that helps us confirm it."
            />
            <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              At least {MIN_EVIDENCE_LENGTH} characters. A reviewer needs something to
              go on — an empty claim can&apos;t be approved.
            </p>
          </div>

          {submitError && <p className="text-sm text-red-300">{submitError}</p>}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={submitting || evidenceTooShort}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting…
                </>
              ) : (
                'Submit claim'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
