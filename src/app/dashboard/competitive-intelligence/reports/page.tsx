'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { ArrowLeft, FileText, Mail, MailCheck } from 'lucide-react'
import { toast } from 'sonner'

type Report = {
  id: string
  reportType: 'daily_digest' | 'weekly_summary' | 'monthly_deep_dive' | 'custom'
  title: string
  content: unknown
  category: string | null
  periodStart: string
  periodEnd: string
  emailSent: boolean
  emailSentAt: string | null
  createdAt: string
}

type KeyFinding = { heading: string; detail: string; severity: string }
type Recommendation = { action: string; rationale: string; priority: 'high' | 'medium' | 'low' }

type WeeklyContent = {
  headline?: string
  executiveSummary?: string
  keyFindings?: KeyFinding[]
  recommendations?: Recommendation[]
  trendNarrative?: string
}

type DigestContent = {
  scores?: Array<{ score: number; rank: number; trend: string }>
  alerts?: Array<{ alertType: string; title: string; severity: string }>
  insights?: Array<{ title: string; severity: string; insightType: string }>
}

const TYPE_LABELS: Record<string, string> = {
  daily_digest: 'Daily digest',
  weekly_summary: 'Weekly summary',
  monthly_deep_dive: 'Monthly deep dive',
  custom: 'Custom',
}

const SEV_CLASS: Record<string, string> = {
  critical: 'bg-red-100 text-red-800',
  warning: 'bg-amber-100 text-amber-800',
  info: 'bg-slate-100 text-slate-700',
  opportunity: 'bg-emerald-100 text-emerald-800',
}

const PRIORITY_CLASS: Record<string, string> = {
  high: 'bg-red-100 text-red-800',
  medium: 'bg-amber-100 text-amber-800',
  low: 'bg-emerald-100 text-emerald-800',
}

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Report | null>(null)

  const fetchReports = useCallback(async () => {
    try {
      const res = await fetch('/api/brand/competitive-intelligence/reports?limit=50', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load reports')
      const json = await res.json()
      setReports(json.reports ?? [])
    } catch {
      toast.error('Could not load reports')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchReports()
  }, [fetchReports])

  if (loading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48" />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <Link
          href="/dashboard/competitive-intelligence"
          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to intelligence
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Reports history</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">
          Daily digests and weekly summaries archived from your competitive intelligence pipeline.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All reports ({reports.length})</CardTitle>
          <CardDescription>Newest first. Click any row to view the full report.</CardDescription>
        </CardHeader>
        <CardContent>
          {reports.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-sm text-slate-500">
              <FileText className="h-6 w-6 text-slate-400" />
              No reports yet. They'll appear here once the daily and weekly crons run.
            </div>
          ) : (
            <div className="divide-y">
              {reports.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setSelected(r)}
                  className="flex w-full flex-col gap-1 py-3 text-left hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-200 rounded px-2 -mx-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium text-slate-900">{r.title}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <Badge variant="secondary" className="capitalize">
                          {TYPE_LABELS[r.reportType] ?? r.reportType}
                        </Badge>
                        {r.category && (
                          <Badge variant="secondary" className="capitalize">{r.category}</Badge>
                        )}
                        <span>
                          {r.periodStart}
                          {r.periodStart !== r.periodEnd && ` → ${r.periodEnd}`}
                        </span>
                        <span>· {formatDistanceToNow(new Date(r.createdAt), { addSuffix: true })}</span>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1 text-xs text-slate-500">
                      {r.emailSent ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600">
                          <MailCheck className="h-3.5 w-3.5" /> Emailed
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-slate-400">
                          <Mail className="h-3.5 w-3.5" /> Pending
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(v) => { if (!v) setSelected(null) }}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="pr-6">{selected.title}</DialogTitle>
                <DialogDescription className="flex flex-wrap items-center gap-2 text-xs">
                  <Badge variant="secondary" className="capitalize">
                    {TYPE_LABELS[selected.reportType] ?? selected.reportType}
                  </Badge>
                  {selected.category && (
                    <Badge variant="secondary" className="capitalize">{selected.category}</Badge>
                  )}
                  <span>{selected.periodStart}{selected.periodStart !== selected.periodEnd && ` → ${selected.periodEnd}`}</span>
                </DialogDescription>
              </DialogHeader>
              <ReportBody report={selected} />
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ReportBody({ report }: { report: Report }) {
  if (report.reportType === 'weekly_summary' || report.reportType === 'monthly_deep_dive') {
    const c = (report.content ?? {}) as WeeklyContent
    return (
      <div className="space-y-4 text-sm">
        {c.headline && (
          <div className="rounded-md bg-slate-50 p-3 font-medium text-slate-900">{c.headline}</div>
        )}
        {c.executiveSummary && (
          <p className="leading-relaxed text-slate-700">{c.executiveSummary}</p>
        )}
        {c.keyFindings && c.keyFindings.length > 0 && (
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Key findings</div>
            <div className="space-y-2">
              {c.keyFindings.map((f, idx) => (
                <div key={idx} className="rounded border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-medium text-slate-900">{f.heading}</div>
                    <Badge variant="secondary" className={SEV_CLASS[f.severity] ?? ''}>
                      {f.severity}
                    </Badge>
                  </div>
                  <p className="mt-1 text-slate-600">{f.detail}</p>
                </div>
              ))}
            </div>
          </div>
        )}
        {c.recommendations && c.recommendations.length > 0 && (
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Recommendations</div>
            <div className="space-y-2">
              {c.recommendations.map((r, idx) => (
                <div key={idx} className="rounded border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-medium text-slate-900">{r.action}</div>
                    <Badge variant="secondary" className={PRIORITY_CLASS[r.priority] ?? ''}>
                      {r.priority}
                    </Badge>
                  </div>
                  {r.rationale && <p className="mt-1 text-slate-600">{r.rationale}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
        {c.trendNarrative && (
          <div className="rounded-md bg-amber-50 p-3 text-amber-900">
            <div className="text-xs font-semibold uppercase tracking-wide">Trend</div>
            <p className="mt-1 leading-relaxed">{c.trendNarrative}</p>
          </div>
        )}
      </div>
    )
  }
  if (report.reportType === 'daily_digest') {
    const c = (report.content ?? {}) as DigestContent
    return (
      <div className="space-y-4 text-sm">
        {c.scores && c.scores.length > 0 && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {c.scores.map((s, idx) => (
              <div key={idx} className="rounded border p-2.5">
                <div className="text-xs text-slate-500">Rank #{s.rank}</div>
                <div className="text-xl font-bold tabular-nums">{s.score}</div>
                <div className="text-xs text-slate-500 capitalize">{s.trend}</div>
              </div>
            ))}
          </div>
        )}
        {c.alerts && c.alerts.length > 0 && (
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Alerts</div>
            <ul className="space-y-1">
              {c.alerts.map((a, idx) => (
                <li key={idx} className="flex items-center justify-between rounded border px-2.5 py-1.5">
                  <span className="text-slate-800">{a.title}</span>
                  <Badge variant="secondary" className={SEV_CLASS[a.severity] ?? ''}>{a.severity}</Badge>
                </li>
              ))}
            </ul>
          </div>
        )}
        {c.insights && c.insights.length > 0 && (
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Insights</div>
            <ul className="space-y-1">
              {c.insights.map((i, idx) => (
                <li key={idx} className="flex items-center justify-between rounded border px-2.5 py-1.5">
                  <span className="text-slate-800">{i.title}</span>
                  <Badge variant="secondary" className={SEV_CLASS[i.severity] ?? ''}>{i.severity}</Badge>
                </li>
              ))}
            </ul>
          </div>
        )}
        {(!c.alerts || c.alerts.length === 0) && (!c.insights || c.insights.length === 0) && (
          <p className="text-sm text-slate-500">Quiet day — no alerts or insights were generated.</p>
        )}
      </div>
    )
  }
  return (
    <pre className="max-h-96 overflow-auto rounded bg-slate-50 p-3 text-xs text-slate-600">
      {JSON.stringify(report.content, null, 2)}
    </pre>
  )
}
