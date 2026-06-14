'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  CheckCircle2, XCircle, Clock, AlertTriangle, ShieldCheck, Loader2,
  Send, ChevronRight, Mail,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'
import { apiPost } from '@/lib/api-client'
import { EmailVerificationContextBanner } from '@/components/EmailVerificationContextBanner'

const POLL_INTERVAL_MS = 30_000

type CheckRow = { passed: boolean; value?: unknown; threshold?: unknown }
type LivePreview = {
  tier: 1 | 2 | 3
  autoDecision: 'approve' | 'reject' | 'review'
  checks: Record<string, CheckRow>
  failedChecks: string[]
  totalFollowers: number
  reason: string
}
type StatusResponse = {
  profileStatus: 'unverified' | 'pending' | 'verified'
  openRequest: { id: string; status: string; createdAt: string; applicationMessage: string | null } | null
  lastDecision: {
    id: string; status: string; createdAt: string; reviewedAt: string | null
    reviewNotes: string | null; eligibleToReapplyAt: string | null
    thresholdCheckResult: LivePreview | null
  } | null
  cooldownUntil: string | null
  livePreview: LivePreview | null
}

const CHECK_LABELS: Record<string, { label: string; describe: (r: CheckRow) => string }> = {
  emailVerified:        { label: 'Verified email',                describe: (r) => r.passed ? 'Verified' : 'Verify your email first' },
  profilePhoto:         { label: 'Profile photo uploaded',        describe: (r) => r.passed ? 'Uploaded' : 'Add a profile photo' },
  bioLength:            { label: 'Bio at least 50 characters',    describe: (r) => `${r.value ?? 0} / ${r.threshold ?? '?'} chars` },
  niches:               { label: 'At least 2 niches selected',    describe: (r) => `${r.value ?? 0} / ${r.threshold ?? '?'} selected` },
  socialHandles:        { label: 'At least 1 social handle',      describe: (r) => `${r.value ?? 0} / ${r.threshold ?? '?'} added` },
  accountAge:           { label: 'Account at least 7 days old',   describe: (r) => `${r.value ?? 0} day(s)` },
  onboardingComplete:   { label: 'Onboarding wizard completed',   describe: (r) => r.passed ? 'Completed' : 'Finish the 6-step wizard' },
  profileCompleteness:  { label: 'Profile completeness >= 80%',   describe: (r) => `${r.value ?? 0}% / ${r.threshold ?? '?'}%` },
}

function StatusBadgeForRequest({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending:        { label: 'Pending',         cls: 'bg-amber-500/15 text-amber-600 border-amber-500/30' },
    auto_approved:  { label: 'Auto-approved',   cls: 'bg-green-500/15 text-green-600 border-green-500/30' },
    auto_rejected:  { label: 'Auto-rejected',   cls: 'bg-red-500/15 text-red-600 border-red-500/30' },
    manual_review:  { label: 'Under review',    cls: 'bg-blue-500/15 text-blue-600 border-blue-500/30' },
    approved:       { label: 'Approved',        cls: 'bg-green-500/15 text-green-600 border-green-500/30' },
    rejected:       { label: 'Rejected',        cls: 'bg-red-500/15 text-red-600 border-red-500/30' },
    needs_info:     { label: 'Needs your info', cls: 'bg-amber-500/15 text-amber-600 border-amber-500/30' },
  }
  const m = map[status] ?? { label: status, cls: 'bg-muted text-muted-foreground border-border' }
  return <Badge variant="outline" className={m.cls}>{m.label}</Badge>
}

export function VerificationClient() {
  const [data, setData] = useState<StatusResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [applicationMessage, setApplicationMessage] = useState('')
  const [brandContactNotes, setBrandContactNotes] = useState('')
  const [portfolioLinks, setPortfolioLinks] = useState<string[]>(['', '', '', '', ''])
  const [requestManualReview, setRequestManualReview] = useState(false)

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/influencer/verification/status', { credentials: 'same-origin' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body?.error ?? `Failed to load status (${res.status})`)
        setLoading(false)
        return
      }
      const json = (await res.json()) as StatusResponse
      setData(json)
      setError(null)
      setLoading(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error')
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchStatus()
    const id = setInterval(() => void fetchStatus(), POLL_INTERVAL_MS)
    return () => clearInterval(id)
  }, [fetchStatus])

  const onSubmit = async () => {
    if (submitting) return
    setSubmitting(true)
    try {
      const cleanedLinks = portfolioLinks.map((s) => s.trim()).filter(Boolean).slice(0, 5)
      const res = await apiPost('/api/influencer/verification/request', {
        applicationMessage: applicationMessage.trim() || undefined,
        brandContactNotes: brandContactNotes.trim() || undefined,
        portfolioLinks: cleanedLinks.length > 0 ? cleanedLinks : undefined,
        requestManualReview,
      })
      const body = await res.json().catch(() => ({} as Record<string, unknown>))
      if (!res.ok) {
        toast.error((body as { error?: string }).error ?? `Failed (${res.status})`)
        await fetchStatus()
        return
      }
      const status = (body as { status?: string }).status
      if (status === 'auto_approved') toast.success("You're verified! The badge is live on your profile.")
      else if (status === 'manual_review') toast.success("Submitted - our team will review within a few business days.")
      else if (status === 'auto_rejected') toast.error("Auto-rejected - see the checklist for what to fix before re-applying.")
      else toast.success('Submitted.')
      setApplicationMessage('')
      setBrandContactNotes('')
      setPortfolioLinks(['', '', '', '', ''])
      setRequestManualReview(false)
      await fetchStatus()
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }
  if (error) {
    return (
      <Card>
        <CardContent className="p-6 space-y-3">
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" onClick={() => void fetchStatus()}>Try again</Button>
        </CardContent>
      </Card>
    )
  }
  if (!data) return null

  const isVerified = data.profileStatus === 'verified'
  const hasOpenRequest = !!data.openRequest
  const inCooldown = !!data.cooldownUntil
  const livePreview = data.livePreview
  const allBasicChecksPassing = livePreview && livePreview.failedChecks.length === 0
  const passedCount = livePreview ? Object.values(livePreview.checks).filter((c) => c.passed).length : 0
  const totalCount = livePreview ? Object.keys(livePreview.checks).length : 8

  const canSubmit =
    !submitting &&
    !isVerified &&
    !hasOpenRequest &&
    !inCooldown &&
    livePreview !== null &&
    livePreview.autoDecision !== 'reject'

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <EmailVerificationContextBanner
        context="Verify your email first — it's the first of the 8 verification checks."
      />

      <div>
        <h1 className="text-2xl font-bold font-headline flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-primary" />
          Influencer verification
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Verified influencers get a trust badge on every campaign application
          and higher visibility in brand search.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            Current status
            <StatusBadgeForRequest status={data.profileStatus === 'verified' ? 'approved' : data.openRequest?.status ?? data.profileStatus} />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isVerified && (
            <div className="flex items-start gap-3 p-3 rounded-md bg-green-500/10 border border-green-500/30">
              <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">You&apos;re verified</p>
                <p className="text-xs text-muted-foreground mt-1">The badge is live on your profile across the marketplace.</p>
              </div>
            </div>
          )}
          {!isVerified && hasOpenRequest && data.openRequest && (
            <div className="flex items-start gap-3 p-3 rounded-md bg-blue-500/10 border border-blue-500/30">
              <Clock className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">
                  {data.openRequest.status === 'needs_info' ? 'We asked for more information' : 'Your request is in review'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Submitted {new Date(data.openRequest.createdAt).toLocaleDateString()}.
                  {data.openRequest.status === 'manual_review' && ' Our team typically responds within a few business days.'}
                </p>
              </div>
            </div>
          )}
          {!isVerified && !hasOpenRequest && inCooldown && data.cooldownUntil && (
            <div className="flex items-start gap-3 p-3 rounded-md bg-amber-500/10 border border-amber-500/30">
              <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">In cooldown — can re-apply soon</p>
                <p className="text-xs text-muted-foreground mt-1">
                  After your last decision, you can re-apply on{' '}
                  <strong className="text-foreground">
                    {new Date(data.cooldownUntil).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                  </strong>.
                  {data.lastDecision?.reviewNotes && (
                    <span className="italic"> Reviewer note: &ldquo;{data.lastDecision.reviewNotes}&rdquo;</span>
                  )}
                </p>
              </div>
            </div>
          )}
          {!isVerified && !hasOpenRequest && !inCooldown && data.lastDecision?.status === 'auto_rejected' && (
            <div className="flex items-start gap-3 p-3 rounded-md bg-red-500/10 border border-red-500/30">
              <XCircle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">Auto-rejected — fix items below and re-apply</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Your last request hit a hard-floor check. No cooldown — submit again any time once the items below are green.
                </p>
              </div>
            </div>
          )}
          {!isVerified && !hasOpenRequest && !inCooldown && !data.lastDecision && (
            <p className="text-sm text-muted-foreground">
              You haven&apos;t submitted yet. Once all 8 items in the checklist below are green you&apos;re ready to submit.
            </p>
          )}
        </CardContent>
      </Card>

      {!isVerified && livePreview && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Live checklist — {passedCount} of {totalCount} requirements met</CardTitle>
            <CardDescription>
              Updates as you edit your profile. Click{' '}
              <Link href="/dashboard/influencer/profile" className="text-primary underline underline-offset-2">
                Influencer Profile
              </Link>{' '}
              to fill missing fields.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {Object.entries(livePreview.checks).map(([key, row]) => {
              const meta = CHECK_LABELS[key] ?? { label: key, describe: () => '' }
              return (
                <div key={key} className={'flex items-start gap-3 p-2 rounded-md ' + (row.passed ? 'bg-green-500/5' : 'bg-muted/40')}>
                  {row.passed ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 shrink-0" aria-hidden="true" />
                  ) : (
                    <XCircle className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" aria-hidden="true" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{meta.label}</p>
                    <p className="text-xs text-muted-foreground">{meta.describe(row)}</p>
                  </div>
                </div>
              )
            })}
            <div className={'flex items-start gap-3 p-2 rounded-md mt-1 border-t border-border pt-3 ' + (livePreview.totalFollowers >= 1000 ? 'bg-green-500/5' : 'bg-muted/40')}>
              {livePreview.totalFollowers >= 1000 ? (
                <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 shrink-0" aria-hidden="true" />
              ) : (
                <ChevronRight className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" aria-hidden="true" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">Total followers across platforms</p>
                <p className="text-xs text-muted-foreground">
                  {livePreview.totalFollowers.toLocaleString()} — auto-approve at 1,000+; 500–999 needs manual review.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {!isVerified && !hasOpenRequest && !inCooldown && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Submit your verification request</CardTitle>
            <CardDescription>Optional fields below help our team review faster if your request lands in the manual queue.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="appMsg">Application message <span className="text-muted-foreground">(optional)</span></Label>
              <Textarea
                id="appMsg"
                placeholder="Tell us about your work, your audience, any brands you've collaborated with..."
                value={applicationMessage}
                onChange={(e) => setApplicationMessage(e.target.value.slice(0, 1000))}
                rows={4}
                maxLength={1000}
              />
              <p className="text-xs text-muted-foreground">{applicationMessage.length} / 1000</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="brandRef">Brand contact / referral notes <span className="text-muted-foreground">(optional)</span></Label>
              <Textarea
                id="brandRef"
                placeholder="e.g. 'Currently collaborating with brand X' or 'Was referred by Y'"
                value={brandContactNotes}
                onChange={(e) => setBrandContactNotes(e.target.value.slice(0, 500))}
                rows={2}
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground">{brandContactNotes.length} / 500</p>
            </div>
            <div className="space-y-2">
              <Label>Portfolio links <span className="text-muted-foreground">(up to 5, optional)</span></Label>
              {portfolioLinks.map((link, i) => (
                <Input
                  key={i}
                  type="url"
                  placeholder="https://"
                  value={link}
                  onChange={(e) => {
                    const next = [...portfolioLinks]
                    next[i] = e.target.value
                    setPortfolioLinks(next)
                  }}
                />
              ))}
            </div>
            <div className="flex items-start gap-3 pt-2">
              <Checkbox id="manualReview" checked={requestManualReview} onCheckedChange={(c) => setRequestManualReview(c === true)} />
              <div className="flex-1">
                <Label htmlFor="manualReview" className="cursor-pointer">Request manual review even if I qualify for auto-approval</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Useful if your follower numbers are hard to verify automatically or you want a human to look at your application context.
                </p>
              </div>
            </div>
            <div className="pt-2 flex flex-col sm:flex-row gap-2">
              <Button onClick={onSubmit} disabled={!canSubmit} className="sm:flex-1">
                {submitting ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Submitting…</>
                ) : allBasicChecksPassing ? (
                  <><Send className="mr-2 h-4 w-4" />Submit for verification</>
                ) : (
                  <><Mail className="mr-2 h-4 w-4" />Submit (manual review)</>
                )}
              </Button>
              {!canSubmit && livePreview?.autoDecision === 'reject' && (
                <p className="text-xs text-destructive self-center sm:max-w-xs">
                  Fix the hard-floor items in the checklist above before submitting.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
