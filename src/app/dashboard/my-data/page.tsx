'use client'

/**
 * Consumer Data Export — GDPR Art. 15 / DPDP §11
 * /dashboard/my-data
 *
 * Displays and allows download of the complete personal data snapshot
 * the platform holds for the authenticated consumer.
 *
 * Sections: profile, consent records, signals, sensitive data categories, ICP scores.
 */

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Download, Loader2, AlertCircle, User, ShieldCheck, Activity,
  Lock, Target, RefreshCw, CheckCircle2, XCircle, FileText, Clock,
} from 'lucide-react'
import { toast } from 'sonner'

// ── Types ─────────────────────────────────────────────────────────

type MyDataResponse = {
  exportedAt: string
  userId: string
  legalBasis: { gdpr: string; dpdp: string }
  profile: {
    email: string
    demographics: Record<string, unknown> | null
    interests: unknown
    notificationPreferences: Record<string, unknown> | null
    onboardingComplete: boolean | null
    createdAt: string | null
    updatedAt: string | null
    lastSignalComputedAt: string | null
  }
  consent: {
    dataCategory: string
    granted: boolean
    grantedAt: string | null
    revokedAt: string | null
    purpose: string | null
    legalBasis: string | null
    consentVersion: string | null
  }[]
  signals: {
    latest: Record<string, { signals: Record<string, unknown>; snapshotAt: string; triggeredBy: string } | null>
    history: { signalCategory: string; snapshotAt: string; triggeredBy: string; signals: unknown }[]
    totalSnapshots: number
  }
  sensitiveData: {
    note: string
    storedCategories: string[]
  }
  icpMatchScores: {
    icpId: string
    matchScore: number
    computedAt: string
    isStale: boolean
    consentGaps: string[]
    explainability: string | null
  }[]
}

// ── Helpers ───────────────────────────────────────────────────────

function KVRow({ label, value }: { label: string; value: unknown }) {
  const display =
    value === null || value === undefined
      ? <span className="text-muted-foreground/60 italic">not set</span>
      : typeof value === 'boolean'
      ? value ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600 inline" /> : <XCircle className="h-3.5 w-3.5 text-muted-foreground inline" />
      : typeof value === 'object'
      ? <pre className="whitespace-pre-wrap font-mono text-[11px] text-muted-foreground">{JSON.stringify(value, null, 2)}</pre>
      : <span>{String(value)}</span>

  return (
    <div className="grid grid-cols-[180px_1fr] gap-2 text-xs py-1">
      <dt className="text-muted-foreground font-medium">{label}</dt>
      <dd className="break-all">{display}</dd>
    </div>
  )
}

function SectionCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ElementType
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Icon className="h-4 w-4" />
          {title}
        </CardTitle>
        {description && <CardDescription className="text-xs">{description}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

// ── Component ─────────────────────────────────────────────────────

// ── DSAR Types ────────────────────────────────────────────────────

type DsarStatus = {
  requestId: string | null
  status: 'pending' | 'otp_sent' | 'verified' | 'generating' | 'completed' | 'failed' | 'expired' | null
  createdAt: string | null
  otpExpiresAt: string | null
  expiresAt: string | null
  downloadUrl: string | null
  otpAttempts: number
  maxOtpAttempts: number
}

function formatTimeRemaining(isoDate: string | null): string {
  if (!isoDate) return ''
  const ms = new Date(isoDate).getTime() - Date.now()
  if (ms <= 0) return 'Expired'
  const totalSec = Math.floor(ms / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function daysUntil(isoDate: string | null): number {
  if (!isoDate) return 0
  return Math.max(0, Math.ceil((new Date(isoDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
}

export default function MyDataPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [data, setData] = useState<MyDataResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // DSAR state
  const [dsarStatus, setDsarStatus] = useState<DsarStatus | null>(null)
  const [dsarLoading, setDsarLoading] = useState(false)
  const [otpOpen, setOtpOpen] = useState(false)
  const [otp, setOtp] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [otpTimeLeft, setOtpTimeLeft] = useState('')
  const [resendCooldown, setResendCooldown] = useState(0)

  const userRole = (session?.user as any)?.role

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth/signin')
    if (status === 'authenticated' && userRole && userRole !== 'consumer') router.push('/dashboard')
  }, [status, userRole, router])

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)

    try {
      const res = await fetch('/api/consumer/my-data')
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error ?? 'Failed to load data export')
      }
      setData(await res.json())
      if (isRefresh) toast.success('Data refreshed')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    if (status === 'authenticated' && userRole === 'consumer') {
      fetchData()
      fetchDsarStatus()
    }
  }, [status, userRole, fetchData])

  // ── DSAR helpers ─────────────────────────────────────────────────

  const fetchDsarStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/consumer/dsar/status')
      if (!res.ok) return
      const json = await res.json()
      setDsarStatus(json.status ? json : { ...json, status: null })
    } catch {}
  }, [])

  // Poll while generating
  useEffect(() => {
    if (dsarStatus?.status !== 'generating') return
    const t = setInterval(fetchDsarStatus, 4000)
    return () => clearInterval(t)
  }, [dsarStatus?.status, fetchDsarStatus])

  // OTP countdown timer
  useEffect(() => {
    if (!dsarStatus?.otpExpiresAt || dsarStatus.status !== 'otp_sent') return
    const t = setInterval(() => setOtpTimeLeft(formatTimeRemaining(dsarStatus.otpExpiresAt)), 1000)
    setOtpTimeLeft(formatTimeRemaining(dsarStatus.otpExpiresAt))
    return () => clearInterval(t)
  }, [dsarStatus?.otpExpiresAt, dsarStatus?.status])

  // Resend cooldown
  useEffect(() => {
    if (resendCooldown <= 0) return
    const t = setTimeout(() => setResendCooldown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [resendCooldown])

  async function handleDsarRequest() {
    setDsarLoading(true)
    try {
      const res = await fetch('/api/consumer/dsar/request', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to initiate request')
      await fetchDsarStatus()
      setOtp('')
      setOtpOpen(true)
      setResendCooldown(60)
      toast.success('Verification code sent to your email.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Request failed')
    } finally {
      setDsarLoading(false)
    }
  }

  async function handleVerify() {
    if (otp.length !== 6) return
    setVerifying(true)
    try {
      const res = await fetch('/api/consumer/dsar/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: dsarStatus?.requestId, otp }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Verification failed')
      setOtpOpen(false)
      setOtp('')
      await fetchDsarStatus()
      toast.success('Verified! Your data package is ready.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Verification failed')
      await fetchDsarStatus()
    } finally {
      setVerifying(false)
    }
  }

  async function handleResendOtp() {
    if (resendCooldown > 0) return
    await handleDsarRequest()
  }

  function downloadJSON() {
    if (!data) return
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `earn4insights-my-data-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Data export downloaded')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="text-sm text-muted-foreground">{error ?? 'Failed to load data'}</p>
        <Button variant="outline" size="sm" onClick={() => fetchData()}>Try again</Button>
      </div>
    )
  }

  const grantedConsents = data.consent.filter((c) => c.granted && !c.revokedAt)
  const revokedConsents = data.consent.filter((c) => c.revokedAt)

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-headline flex items-center gap-2">
            <Download className="h-6 w-6" />
            My Data Export
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Full portable snapshot of your personal data under GDPR Art. 15 &amp; India DPDP Act §11.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            disabled={refreshing}
            onClick={() => fetchData(true)}
          >
            {refreshing
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <RefreshCw className="h-3.5 w-3.5" />
            }
          </Button>
          <Button size="sm" onClick={downloadJSON}>
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Download JSON
          </Button>
        </div>
      </div>

      {/* Export metadata */}
      <Card className="bg-muted/40">
        <CardContent className="py-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span>Exported: {new Date(data.exportedAt).toLocaleString()}</span>
          <span>·</span>
          <span>{data.legalBasis.gdpr}</span>
          <span>·</span>
          <span>{data.legalBasis.dpdp}</span>
        </CardContent>
      </Card>

      {/* ── Profile ── */}
      <SectionCard icon={User} title="Profile" description="Your account and demographic information.">
        <dl className="space-y-0.5">
          <KVRow label="Email" value={data.profile.email} />
          <KVRow label="Onboarding complete" value={data.profile.onboardingComplete} />
          <KVRow label="Account created" value={data.profile.createdAt ? new Date(data.profile.createdAt).toLocaleString() : null} />
          <KVRow label="Last updated" value={data.profile.updatedAt ? new Date(data.profile.updatedAt).toLocaleString() : null} />
          <KVRow label="Last signals computed" value={data.profile.lastSignalComputedAt ? new Date(data.profile.lastSignalComputedAt).toLocaleString() : null} />
        </dl>
        {data.profile.demographics && Object.keys(data.profile.demographics).length > 0 && (
          <>
            <Separator className="my-3" />
            <p className="text-xs font-medium mb-2 text-muted-foreground">Demographics</p>
            <dl className="space-y-0.5">
              {Object.entries(data.profile.demographics).map(([k, v]) => (
                <KVRow key={k} label={k} value={v} />
              ))}
            </dl>
          </>
        )}
        {!!data.profile.interests && (
          <>
            <Separator className="my-3" />
            <p className="text-xs font-medium mb-2 text-muted-foreground">Interests</p>
            <pre className="text-[11px] text-muted-foreground whitespace-pre-wrap">
              {JSON.stringify(data.profile.interests, null, 2)}
            </pre>
          </>
        )}
      </SectionCard>

      {/* ── Consent ── */}
      <SectionCard
        icon={ShieldCheck}
        title="Consent Records"
        description={`${grantedConsents.length} active · ${revokedConsents.length} revoked · ${data.consent.length} total categories`}
      >
        <Accordion type="multiple" className="space-y-1">
          <AccordionItem value="active" className="border rounded-md px-3">
            <AccordionTrigger className="text-sm py-2 hover:no-underline">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                Active consents ({grantedConsents.length})
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2 pt-1 pb-2">
                {grantedConsents.length === 0
                  ? <p className="text-xs text-muted-foreground">No active consents.</p>
                  : grantedConsents.map((c) => (
                    <div key={c.dataCategory} className="text-xs border rounded p-2 space-y-0.5">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{c.dataCategory}</span>
                        <Badge variant="secondary" className="text-[10px]">{c.legalBasis}</Badge>
                      </div>
                      <p className="text-muted-foreground">{c.purpose}</p>
                      <p className="text-muted-foreground/70">
                        Granted: {c.grantedAt ? new Date(c.grantedAt).toLocaleString() : '—'}
                        {c.consentVersion && ` · v${c.consentVersion}`}
                      </p>
                    </div>
                  ))
                }
              </div>
            </AccordionContent>
          </AccordionItem>

          {revokedConsents.length > 0 && (
            <AccordionItem value="revoked" className="border rounded-md px-3">
              <AccordionTrigger className="text-sm py-2 hover:no-underline">
                <span className="flex items-center gap-2">
                  <XCircle className="h-3.5 w-3.5 text-muted-foreground" />
                  Revoked consents ({revokedConsents.length})
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2 pt-1 pb-2">
                  {revokedConsents.map((c) => (
                    <div key={c.dataCategory} className="text-xs border rounded p-2 space-y-0.5 opacity-60">
                      <span className="font-medium">{c.dataCategory}</span>
                      <p className="text-muted-foreground/70">
                        Revoked: {c.revokedAt ? new Date(c.revokedAt).toLocaleString() : '—'}
                      </p>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}
        </Accordion>

        <p className="text-xs text-muted-foreground mt-3">
          To change your consent choices, visit{' '}
          <Link href="/dashboard/privacy" className="underline underline-offset-2">Privacy &amp; Consent</Link>.
        </p>
      </SectionCard>

      {/* ── Signals ── */}
      <SectionCard
        icon={Activity}
        title="Signal Snapshots"
        description={`${data.signals.totalSnapshots} total snapshots across all categories.`}
      >
        {Object.keys(data.signals.latest).length === 0 ? (
          <p className="text-sm text-muted-foreground">No signal snapshots yet.</p>
        ) : (
          <Accordion type="multiple">
            {Object.entries(data.signals.latest).map(([category, snap]) => (
              <AccordionItem key={category} value={category} className="border-b last:border-0">
                <AccordionTrigger className="text-sm hover:no-underline py-2">
                  <span className="flex items-center gap-2">
                    <span className="font-medium capitalize">{category}</span>
                    {snap?.snapshotAt && (
                      <span className="text-xs text-muted-foreground font-normal">
                        {new Date(snap.snapshotAt).toLocaleDateString()}
                      </span>
                    )}
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  {snap?.signals
                    ? (
                      <ScrollArea className="h-[200px] pr-3">
                        <dl className="space-y-0.5 pb-2">
                          {Object.entries(snap.signals).map(([k, v]) => (
                            <KVRow key={k} label={k} value={v} />
                          ))}
                        </dl>
                      </ScrollArea>
                    )
                    : <p className="text-xs text-muted-foreground">No snapshot data.</p>
                  }
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </SectionCard>

      {/* ── Sensitive data ── */}
      <SectionCard
        icon={Lock}
        title="Sensitive Personal Data"
        description="GDPR Art. 9 / DPDP sensitive personal data — stored encrypted."
      >
        <p className="text-xs text-muted-foreground mb-3">{data.sensitiveData.note}</p>
        {data.sensitiveData.storedCategories.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">No sensitive data stored.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {data.sensitiveData.storedCategories.map((cat) => (
              <Badge key={cat} variant="outline" className="text-xs border-amber-400 text-amber-700">
                {cat}
              </Badge>
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-3">
          Sensitive values are stored encrypted (AES-256-GCM). Use the{' '}
          <button
            onClick={() => document.getElementById('dsar-section')?.scrollIntoView({ behavior: 'smooth' })}
            className="underline underline-offset-2 cursor-pointer"
          >
            Download Your Data
          </button>{' '}
          section below to receive your full data report, or contact{' '}
          <a href="mailto:privacy@earn4insights.com" className="underline underline-offset-2">
            privacy@earn4insights.com
          </a>{' '}
          for a manually decrypted copy.
        </p>
      </SectionCard>

      {/* ── ICP match scores ── */}
      <SectionCard
        icon={Target}
        title="ICP Match Scores"
        description={`${data.icpMatchScores.length} brand ICP scores on record for your profile.`}
      >
        {data.icpMatchScores.length === 0 ? (
          <p className="text-sm text-muted-foreground">No ICP scores yet.</p>
        ) : (
          <div className="space-y-2">
            {data.icpMatchScores.map((score, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg border px-3 py-2">
                <div className="min-w-0">
                  <p className="text-xs font-mono text-muted-foreground truncate">
                    ICP: {score.icpId.slice(0, 16)}…
                  </p>
                  {score.explainability && (
                    <p className="text-[11px] text-muted-foreground mt-0.5 truncate max-w-xs">
                      {score.explainability}
                    </p>
                  )}
                  {score.consentGaps.length > 0 && (
                    <p className="text-[11px] text-amber-600 mt-0.5">
                      Skipped criteria: {score.consentGaps.join(', ')}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  {score.isStale && (
                    <Badge variant="outline" className="text-[10px] px-1.5">stale</Badge>
                  )}
                  <Badge
                    variant={score.matchScore >= 80 ? 'default' : score.matchScore >= 60 ? 'secondary' : 'outline'}
                    className="text-xs font-bold"
                  >
                    {score.matchScore}%
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-3">
          These scores are computed based on your consented signal data. Revoking consent recalculates scores
          automatically. Brands never see your identity — only aggregate audience statistics.
        </p>
      </SectionCard>

      {/* ── DSAR — Download Your Data (PDF) ── */}
      <div id="dsar-section">
      <SectionCard
        icon={FileText}
        title="Download Your Data (PDF Report)"
        description="Receive a complete, human-readable PDF of all data we hold about you — GDPR Art. 15 / DPDP §11."
      >
        {/* No request yet */}
        {(!dsarStatus?.status || dsarStatus.status === 'expired' || dsarStatus.status === 'failed') && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Your report will include account info, consents, feedback, surveys, points, community activity,
              influencer activity, and your full rights under GDPR and the India DPDP Act 2023.
              A 6-digit verification code will be sent to your registered email.
            </p>
            {dsarStatus?.status === 'expired' && (
              <p className="text-xs text-amber-600">Your previous data package has expired.</p>
            )}
            {dsarStatus?.status === 'failed' && (
              <p className="text-xs text-red-600">Previous generation failed. Please try again.</p>
            )}
            <Button onClick={handleDsarRequest} disabled={dsarLoading} size="sm">
              {dsarLoading ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <FileText className="mr-2 h-3.5 w-3.5" />}
              Request My Data
            </Button>
            <p className="text-xs text-muted-foreground">Rate limited to 1 request per 30 days. Free of charge.</p>
          </div>
        )}

        {/* OTP sent — awaiting verification */}
        {dsarStatus?.status === 'otp_sent' && !otpOpen && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
              <Clock className="h-4 w-4 shrink-0" />
              <span>Verification code sent. Check your email. Code expires in <strong>{otpTimeLeft || '…'}</strong>.</span>
            </div>
            <Button size="sm" variant="outline" onClick={() => { setOtp(''); setOtpOpen(true) }}>
              Enter Verification Code
            </Button>
          </div>
        )}

        {/* Generating */}
        {dsarStatus?.status === 'generating' && (
          <div className="flex items-center gap-3 text-sm text-slate-600 bg-slate-50 border rounded-md px-4 py-3">
            <Loader2 className="h-4 w-4 animate-spin text-indigo-600 shrink-0" />
            <span>Generating your data package… This may take up to 30 seconds.</span>
          </div>
        )}

        {/* Completed */}
        {dsarStatus?.status === 'completed' && dsarStatus.downloadUrl && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>Your data package is ready.</span>
            </div>
            <div className="flex items-center gap-3">
              <Button asChild size="sm">
                <a href={dsarStatus.downloadUrl} download>
                  <Download className="mr-2 h-3.5 w-3.5" />
                  Download PDF
                </a>
              </Button>
              {dsarStatus.expiresAt && (
                <span className="text-xs text-muted-foreground">
                  Link expires in <strong>{daysUntil(dsarStatus.expiresAt)} day{daysUntil(dsarStatus.expiresAt) === 1 ? '' : 's'}</strong>
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              A copy was also emailed to your registered address.
            </p>
          </div>
        )}
      </SectionCard>
      </div>

      {/* OTP Dialog */}
      <Dialog open={otpOpen} onOpenChange={open => { if (!verifying) setOtpOpen(open) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Verify your identity</DialogTitle>
            <DialogDescription>
              Enter the 6-digit code sent to your registered email address.
              {otpTimeLeft && otpTimeLeft !== 'Expired' && (
                <span className="block mt-1 text-amber-600 font-medium">Expires in {otpTimeLeft}</span>
              )}
              {otpTimeLeft === 'Expired' && (
                <span className="block mt-1 text-red-600 font-medium">Code has expired. Please request a new one.</span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <Label htmlFor="otp-input">Verification code</Label>
            <Input
              id="otp-input"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              placeholder="000000"
              value={otp}
              onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="text-center text-2xl tracking-[0.5em] font-mono h-12"
              disabled={verifying}
              onKeyDown={e => { if (e.key === 'Enter' && otp.length === 6) handleVerify() }}
              autoFocus
            />
            {dsarStatus?.otpAttempts !== undefined && dsarStatus.otpAttempts > 0 && (
              <p className="text-xs text-amber-600">
                {dsarStatus.maxOtpAttempts - dsarStatus.otpAttempts} attempt{dsarStatus.maxOtpAttempts - dsarStatus.otpAttempts === 1 ? '' : 's'} remaining.
              </p>
            )}
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResendOtp}
              disabled={resendCooldown > 0 || dsarLoading}
              className="text-xs"
            >
              {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
            </Button>
            <Button
              onClick={handleVerify}
              disabled={otp.length !== 6 || verifying}
              className="flex-1"
            >
              {verifying
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating your data…</>
                : 'Verify & Generate PDF'
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Legal note */}
      <p className="text-xs text-muted-foreground text-center pb-4">
        This export covers all data categories under GDPR Art. 15 and India DPDP Act 2023 §11.
        For account deletion, visit{' '}
        <Link href="/dashboard/settings" className="underline underline-offset-2">Settings</Link>.
      </p>
    </div>
  )
}
