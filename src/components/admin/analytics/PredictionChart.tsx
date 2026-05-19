'use client'

import { Area, ComposedChart, Line, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowDownRight, ArrowUpRight, MinusIcon, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/currency'
import type { Prediction } from '@/lib/types/platformAnalytics'

interface Props {
  data: Prediction
  title: string                                      // "User growth forecast" / "Revenue forecast"
  formatValue?: (n: number) => string                // axis + tooltip formatter
}

function defaultFormat(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return n.toLocaleString()
}

function compactPaise(v: number): string {
  const rupees = v / 100
  if (rupees >= 1e7) return `₹${(rupees / 1e7).toFixed(1)}Cr`
  if (rupees >= 1e5) return `₹${(rupees / 1e5).toFixed(1)}L`
  if (rupees >= 1000) return `₹${(rupees / 1000).toFixed(1)}k`
  return `₹${rupees.toFixed(0)}`
}

function formatXTick(value: string): string {
  const d = new Date(value)
  if (isNaN(d.getTime())) return value
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

const TREND_COPY = {
  improving: { label: 'Trending up', icon: ArrowUpRight, class: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30' },
  stable: { label: 'Stable', icon: MinusIcon, class: 'text-muted-foreground bg-muted/30 border-border' },
  declining: { label: 'Trending down', icon: ArrowDownRight, class: 'text-rose-500 bg-rose-500/10 border-rose-500/30' },
} as const

export function PredictionChart({ data, title, formatValue }: Props) {
  const fmt = formatValue ?? (data.metric === 'revenue' ? compactPaise : defaultFormat)
  const fmtFull = data.metric === 'revenue' ? (n: number) => formatCurrency(n) : defaultFormat

  const trend = TREND_COPY[data.trend]
  const TrendIcon = trend.icon

  // Find first forecast date — used to mark the "today" boundary line.
  const firstForecast = data.series.find((p) => p.actual == null)
  // For the legend / accuracy hint: pull a synthetic "predicted on last actual day".
  const lastActual = [...data.series].reverse().find((p) => p.actual != null)
  const horizon = data.expectedAtHorizonDays

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
            {title}
          </CardTitle>
          <span
            className={cn(
              'inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-full border',
              trend.class,
            )}
          >
            <TrendIcon className="w-3 h-3" />
            {trend.label}
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground pt-1">
          Expected <span className="text-foreground font-medium">{fmtFull(horizon.value)}</span> in{' '}
          {horizon.days} days &middot; OLS regression on last{' '}
          {data.series.filter((p) => p.actual != null).length} days, 95% CI band shown.
        </p>
      </CardHeader>
      <CardContent>
        <div className="h-[240px]">
          {data.series.length === 0 ? (
            <EmptyState />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data.series}>
                <defs>
                  <linearGradient id={`predBand-${data.metric}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.18} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tickFormatter={formatXTick} tick={{ fontSize: 11 }} minTickGap={32} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={fmt} width={56} />
                <Tooltip
                  contentStyle={{
                    background: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                  labelFormatter={(v) => formatXTick(String(v))}
                  formatter={(value: number | string, name) => {
                    if (value == null) return ['—', name as string]
                    return [fmtFull(Number(value)), name as string]
                  }}
                />
                {firstForecast && (
                  <ReferenceLine
                    x={firstForecast.date}
                    stroke="hsl(var(--muted-foreground))"
                    strokeDasharray="2 4"
                    label={{ value: 'now', position: 'top', fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  />
                )}
                {/* Confidence band — only the forecast tail has confLow/confHigh. */}
                <Area
                  name="Confidence"
                  type="monotone"
                  dataKey="confHigh"
                  stroke="none"
                  fill={`url(#predBand-${data.metric})`}
                  isAnimationActive={false}
                  legendType="none"
                />
                <Area
                  type="monotone"
                  dataKey="confLow"
                  stroke="none"
                  fill="hsl(var(--background))"
                  isAnimationActive={false}
                  legendType="none"
                />
                {/* Actual + predicted — two distinct lines so dashed style only applies to forecast. */}
                <Line
                  name="Actual"
                  type="monotone"
                  dataKey="actual"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={false}
                  connectNulls={false}
                  isAnimationActive={false}
                />
                <Line
                  name="Forecast"
                  type="monotone"
                  dataKey="predicted"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={false}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function EmptyState() {
  return (
    <div className="h-full grid place-items-center text-xs text-muted-foreground text-center">
      Not enough history to forecast yet.<br />Need at least 5 daily data points.
    </div>
  )
}
