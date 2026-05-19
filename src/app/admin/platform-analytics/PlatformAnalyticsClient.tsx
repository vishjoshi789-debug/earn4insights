'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { RefreshCw, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/currency'
import { TimeRangeSelector } from '@/components/admin/analytics/TimeRangeSelector'
import { HealthScoreGauge } from '@/components/admin/analytics/HealthScoreGauge'
import { MetricCard } from '@/components/admin/analytics/MetricCard'
import { UserGrowthChart } from '@/components/admin/analytics/UserGrowthChart'
import { RetentionHeatmap } from '@/components/admin/analytics/RetentionHeatmap'
import { RevenueChart } from '@/components/admin/analytics/RevenueChart'
import { EngagementMiniChart } from '@/components/admin/analytics/EngagementMiniChart'
import { FeatureAdoptionMap } from '@/components/admin/analytics/FeatureAdoptionMap'
import { FinancialOverview } from '@/components/admin/analytics/FinancialOverview'
import { CostBreakdownDonut } from '@/components/admin/analytics/CostBreakdownDonut'
import { CostManagement } from '@/components/admin/analytics/CostManagement'
import { PredictionChart } from '@/components/admin/analytics/PredictionChart'
import Link from 'next/link'
import { Inbox, Bot, Timer, Star } from 'lucide-react'
import type { DashboardPayload, TimeRange } from '@/lib/types/platformAnalytics'

interface Props {
  initial: DashboardPayload
}

const AUTO_REFRESH_MS = 60_000 // 1 min — dashboard panels are not realtime-critical

function compactInt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 10_000) return `${(n / 1_000).toFixed(1)}k`
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}k`
  return n.toString()
}

function compactMoney(paise: number): string {
  const rupees = paise / 100
  if (rupees >= 1e7) return `₹${(rupees / 1e7).toFixed(2)}Cr`
  if (rupees >= 1e5) return `₹${(rupees / 1e5).toFixed(2)}L`
  if (rupees >= 1000) return `₹${(rupees / 1000).toFixed(1)}k`
  return formatCurrency(paise)
}

function firstOfMonthIso(): string {
  const d = new Date()
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString().slice(0, 10)
}

function timeSince(iso: string): string {
  const t = new Date(iso).getTime()
  if (isNaN(t)) return '—'
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000))
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

export default function PlatformAnalyticsClient({ initial }: Props) {
  const [range, setRange] = useState<TimeRange>(initial.range)
  const [data, setData] = useState<DashboardPayload>(initial)
  const [loading, setLoading] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [lastFetchAt, setLastFetchAt] = useState(initial.computedAt)
  const abortRef = useRef<AbortController | null>(null)

  const refetch = useCallback(
    async (nextRange: TimeRange = range) => {
      abortRef.current?.abort()
      const ctl = new AbortController()
      abortRef.current = ctl
      setLoading(true)
      try {
        const res = await fetch(
          `/api/admin/platform-analytics/dashboard?range=${nextRange}`,
          { credentials: 'same-origin', signal: ctl.signal },
        )
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const next = (await res.json()) as DashboardPayload
        setData(next)
        setLastFetchAt(next.computedAt)
      } catch (err) {
        if ((err as any)?.name !== 'AbortError') {
          console.error('[PlatformAnalytics] dashboard fetch failed', err)
        }
      } finally {
        setLoading(false)
      }
    },
    [range],
  )

  // Range change → re-fetch
  useEffect(() => {
    if (range === initial.range && data === initial) return
    void refetch(range)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range])

  // Auto-refresh polling
  useEffect(() => {
    if (!autoRefresh) return
    const id = setInterval(() => void refetch(range), AUTO_REFRESH_MS)
    return () => clearInterval(id)
  }, [autoRefresh, range, refetch])

  return (
    <div className="space-y-4 p-4 md:p-6 max-w-[1400px] mx-auto">
      {/* ── Top bar ───────────────────────────────────────────── */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Platform Analytics</h1>
          <p className="text-xs text-muted-foreground">
            Updated {timeSince(lastFetchAt)} &middot; auto-refresh{' '}
            <span className={autoRefresh ? 'text-emerald-500' : ''}>
              {autoRefresh ? 'on' : 'off'}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <TimeRangeSelector value={range} onChange={setRange} disabled={loading} />
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh((x) => !x)}
            className={cn(autoRefresh && 'border-emerald-500/50 text-emerald-500')}
          >
            <RefreshCw className={cn('w-3.5 h-3.5 mr-1.5', autoRefresh && 'animate-spin')} />
            Auto
          </Button>
          <Button variant="outline" size="sm" onClick={() => void refetch(range)} disabled={loading}>
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          </Button>
        </div>
      </header>

      {data._errors && data._errors.length > 0 && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          {data._errors.length} panel{data._errors.length === 1 ? '' : 's'} could not load — showing partial data.
        </div>
      )}

      {/* ── Row 1 — Health + 4 headline metrics ───────────────── */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
        <HealthScoreGauge score={data.health} />

        <MetricCard
          label="Total users"
          value={compactInt(data.overview.totalUsers)}
          deltaPct={data.overview.growthRatePct}
        >
          <div className="space-y-1 text-[11px] text-muted-foreground">
            <Breakdown
              color="bg-indigo-500"
              label="Brands"
              value={data.overview.stakeholders.brands}
            />
            <Breakdown
              color="bg-emerald-500"
              label="Consumers"
              value={data.overview.stakeholders.consumers}
            />
            <Breakdown
              color="bg-violet-500"
              label="Influencers"
              value={data.overview.stakeholders.influencers}
            />
          </div>
        </MetricCard>

        <MetricCard
          label="DAU / MAU"
          value={data.overview.dauMauRatio.toFixed(2)}
          hint="Good > 0.20 &middot; Great > 0.40"
          spark={data.userGrowth.series.map((p) => p.total)}
          tone={
            data.overview.dauMauRatio >= 0.4
              ? 'positive'
              : data.overview.dauMauRatio >= 0.2
              ? 'default'
              : 'warning'
          }
        />

        <MetricCard
          label="MRR"
          value={compactMoney(data.revenue.mrr)}
          deltaPct={data.revenue.mrrGrowthPct}
          spark={data.revenue.series.map((p) => p.net)}
        />

        <MetricCard
          label="Burn / Runway"
          value={
            data.financial.runwayMonths == null
              ? 'Net positive'
              : `${data.financial.runwayMonths.toFixed(1)} mo`
          }
          hint={`Burn ${compactMoney(Math.max(0, data.financial.burnRate))}/mo`}
          tone={
            data.financial.runwayMonths == null
              ? 'positive'
              : data.financial.runwayMonths >= 12
              ? 'positive'
              : data.financial.runwayMonths >= 6
              ? 'warning'
              : 'critical'
          }
        />
      </section>

      {/* ── Row 2 — User growth (full width) ──────────────────── */}
      <section>
        <UserGrowthChart data={data.userGrowth} />
      </section>

      {/* ── Row 3 — Retention + Revenue ───────────────────────── */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RetentionHeatmap initial={data.retention} />
        <RevenueChart data={data.revenue} />
      </section>

      {/* ── Row 4 — Engagement (4 mini charts) ────────────────── */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <EngagementMiniChart
          title="Feedback submitted"
          total={data.engagement.feedback.total}
          pctChange={data.engagement.feedback.pctChange}
          series={data.engagement.feedback.series}
          color="#6366f1"
        />
        <EngagementMiniChart
          title="Surveys completed"
          total={data.engagement.surveys.total}
          pctChange={data.engagement.surveys.pctChange}
          series={data.engagement.surveys.series}
          color="#10b981"
        />
        <EngagementMiniChart
          title="Deals redeemed"
          total={data.engagement.deals.total}
          pctChange={data.engagement.deals.pctChange}
          series={data.engagement.deals.series}
          color="#f59e0b"
        />
        <EngagementMiniChart
          title="Community activity"
          total={data.engagement.community.totalPosts + data.engagement.community.totalComments}
          pctChange={data.engagement.community.pctChange}
          series={data.engagement.community.series.map((p) => ({
            date: p.date,
            count: p.posts + p.comments,
          }))}
          color="#a855f7"
        />
      </section>

      {/* ── Row 5 — Feature adoption (full width) ─────────────── */}
      <section>
        <FeatureAdoptionMap features={data.engagement.features} />
      </section>

      {/* ── Row 6 — Financial overview + cost breakdown ───────── */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <FinancialOverview data={data.financial} />
        </div>
        <CostBreakdownDonut
          breakdown={data.financial.costBreakdown}
          totalCosts={data.financial.totalCosts}
          month={firstOfMonthIso()}
        />
      </section>

      {/* ── Row 7 — Manage monthly costs ──────────────────────── */}
      <section>
        <CostManagement />
      </section>

      {/* ── Row 8 — Growth predictions ────────────────────────── */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PredictionChart data={data.predictions.users} title="User growth forecast" />
        <PredictionChart data={data.predictions.revenue} title="Revenue forecast" />
      </section>

      {/* ── Row 9 — Support snapshot ──────────────────────────── */}
      <section>
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-base">Support snapshot (last 30d)</CardTitle>
            <Link
              href="/admin/support"
              className="text-xs text-primary hover:underline inline-flex items-center gap-1"
            >
              View full support dashboard →
            </Link>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <SupportTile
                icon={Inbox}
                label="Open tickets"
                value={data.support.openTickets.toLocaleString()}
                tone={data.support.openTickets > 20 ? 'warning' : 'default'}
              />
              <SupportTile
                icon={Bot}
                label="AI resolution"
                value={`${data.support.aiResolutionRatePct.toFixed(1)}%`}
                tone={data.support.aiResolutionRatePct >= 60 ? 'positive' : 'default'}
              />
              <SupportTile
                icon={Timer}
                label="Avg response"
                value={
                  data.support.avgFirstResponseHours == null
                    ? '—'
                    : `${data.support.avgFirstResponseHours.toFixed(1)}h`
                }
                tone={
                  data.support.avgFirstResponseHours != null && data.support.avgFirstResponseHours < 4
                    ? 'positive'
                    : data.support.avgFirstResponseHours != null && data.support.avgFirstResponseHours > 24
                    ? 'critical'
                    : 'default'
                }
              />
              <SupportTile
                icon={Star}
                label="CSAT"
                value={
                  data.support.satisfactionAvg == null
                    ? '—'
                    : `${data.support.satisfactionAvg.toFixed(2)} / 5`
                }
                tone={
                  data.support.satisfactionAvg == null
                    ? 'default'
                    : data.support.satisfactionAvg >= 4
                    ? 'positive'
                    : data.support.satisfactionAvg < 3
                    ? 'critical'
                    : 'warning'
                }
              />
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}

function Breakdown({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-1.5">
        <span className={cn('w-1.5 h-1.5 rounded-full', color)} aria-hidden />
        {label}
      </span>
      <span className="font-medium tabular-nums text-foreground">{compactInt(value)}</span>
    </div>
  )
}

type IconType = React.ComponentType<{ className?: string }>

function SupportTile({
  icon: Icon,
  label,
  value,
  tone = 'default',
}: {
  icon: IconType
  label: string
  value: string
  tone?: 'default' | 'positive' | 'warning' | 'critical'
}) {
  const toneClass = {
    default: 'text-foreground',
    positive: 'text-emerald-500',
    warning: 'text-amber-500',
    critical: 'text-rose-500',
  }[tone]
  return (
    <div className="rounded-md border border-border bg-card/50 px-3 py-2.5">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
        <Icon className="w-3.5 h-3.5" />
        {label}
      </div>
      <p className={cn('text-xl font-semibold tabular-nums leading-tight mt-1', toneClass)}>{value}</p>
    </div>
  )
}
