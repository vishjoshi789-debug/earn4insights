'use client'

import { Area, AreaChart, CartesianGrid, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceDot } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/currency'
import { cn } from '@/lib/utils'
import type { FinancialBlock } from '@/lib/types/platformAnalytics'

interface Props {
  data: FinancialBlock
}

function compactPaise(v: number | string): string {
  const n = typeof v === 'number' ? v : Number(v)
  const rupees = n / 100
  if (rupees >= 1e7) return `₹${(rupees / 1e7).toFixed(1)}Cr`
  if (rupees >= 1e5) return `₹${(rupees / 1e5).toFixed(1)}L`
  if (rupees >= 1000) return `₹${(rupees / 1000).toFixed(1)}k`
  return `₹${rupees.toFixed(0)}`
}

function formatMonth(value: string): string {
  // 'YYYY-MM-DD' (always first of month) → 'Jan'
  const d = new Date(value)
  if (isNaN(d.getTime())) return value
  return d.toLocaleDateString(undefined, { month: 'short' })
}

export function FinancialOverview({ data }: Props) {
  // Build cumulative chart data + locate break-even crossover point (if any).
  // cumulative comes pre-sorted ascending by month from the service.
  let cumRev = 0
  let cumCosts = 0
  const chart = data.cumulative.map((p) => {
    cumRev += p.revenue
    cumCosts += p.costs
    return {
      month: p.month,
      revenue: cumRev,
      costs: cumCosts,
      // gap below zero means costs > revenue (still burning)
      margin: cumRev - cumCosts,
    }
  })

  // Find first month where cumulative revenue first exceeds cumulative costs.
  let breakEven: { month: string; value: number } | null = null
  for (let i = 1; i < chart.length; i++) {
    const prev = chart[i - 1]
    const curr = chart[i]
    if (prev.margin < 0 && curr.margin >= 0) {
      breakEven = { month: curr.month, value: curr.revenue }
      break
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Revenue vs costs (cumulative)</CardTitle>
        <p className="text-[11px] text-muted-foreground pt-1">
          Trailing 12 months. The shaded gap is your margin — net positive when revenue line sits above costs.
          {breakEven && (
            <>
              {' '}Break-even reached in <span className="text-emerald-500 font-medium">{formatMonth(breakEven.month)}</span>.
            </>
          )}
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="h-[260px]">
          {chart.length === 0 ? (
            <EmptyState />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chart}>
                <defs>
                  <linearGradient id="finRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="finCosts" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ef4444" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tickFormatter={formatMonth} tick={{ fontSize: 11 }} minTickGap={16} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={compactPaise} width={56} />
                <Tooltip
                  contentStyle={{
                    background: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                  labelFormatter={(v) => formatMonth(String(v))}
                  formatter={(value: number | string, name) => [formatCurrency(Number(value)), name as string]}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area name="Cumulative revenue" type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} fill="url(#finRevenue)" />
                <Area name="Cumulative costs" type="monotone" dataKey="costs" stroke="#ef4444" strokeWidth={2} fill="url(#finCosts)" />
                {breakEven && (
                  <ReferenceDot x={breakEven.month} y={breakEven.value} r={5} fill="#10b981" stroke="hsl(var(--background))" strokeWidth={2} isFront />
                )}
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-1 border-t border-border text-xs">
          <Stat label="Gross margin" value={`${data.grossMarginPct.toFixed(1)}%`} tone={data.grossMarginPct > 0 ? 'positive' : 'critical'} />
          <Stat label="ARPU" value={formatCurrency(data.arpu)} />
          <Stat label="Brand LTV" value={formatCurrency(data.ltv.brand)} />
          <Stat label="Consumer LTV (cost)" value={formatCurrency(data.ltv.consumer)} />
          <Stat label="Cash balance" value={formatCurrency(data.cashBalance)} tone={data.cashBalance > 0 ? 'positive' : 'critical'} />
          <Stat
            label="Runway"
            value={data.runwayMonths == null ? 'Net positive' : `${data.runwayMonths.toFixed(1)} mo`}
            tone={data.runwayMonths == null || data.runwayMonths >= 12 ? 'positive' : data.runwayMonths >= 6 ? 'warning' : 'critical'}
          />
        </div>
      </CardContent>
    </Card>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'positive' | 'warning' | 'critical' }) {
  const toneClass = {
    positive: 'text-emerald-500',
    warning: 'text-amber-500',
    critical: 'text-rose-500',
  }
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn('text-sm font-semibold tabular-nums', tone ? toneClass[tone] : 'text-foreground')}>{value}</p>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="h-full grid place-items-center text-xs text-muted-foreground">
      Run the monthly financial-snapshot cron to populate this chart.
    </div>
  )
}
