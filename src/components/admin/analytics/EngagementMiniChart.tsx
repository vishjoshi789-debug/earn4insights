'use client'

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MiniSeriesPoint {
  date: string
  count: number
}

interface Props {
  title: string
  total: number
  pctChange: number
  series: MiniSeriesPoint[]
  color?: string                  // bar fill, defaults to primary
  formatTotal?: (n: number) => string
}

function defaultFormat(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return n.toLocaleString()
}

function formatXTick(value: string): string {
  const d = new Date(value)
  if (isNaN(d.getTime())) return value
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function EngagementMiniChart({
  title,
  total,
  pctChange,
  series,
  color = 'hsl(var(--primary))',
  formatTotal = defaultFormat,
}: Props) {
  const Icon =
    pctChange > 0.5 ? ArrowUpRight : pctChange < -0.5 ? ArrowDownRight : ArrowRight
  const tone =
    pctChange > 0.5
      ? 'text-emerald-500'
      : pctChange < -0.5
      ? 'text-rose-500'
      : 'text-muted-foreground'

  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {title}
        </CardTitle>
        <div className="flex items-baseline justify-between gap-2 pt-1">
          <span className="text-2xl font-semibold tabular-nums leading-tight">{formatTotal(total)}</span>
          <span className={cn('inline-flex items-center text-xs font-medium gap-0.5', tone)}>
            <Icon className="w-3 h-3" />
            {Math.abs(pctChange).toFixed(1)}%
          </span>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="h-[90px] px-2 pb-2">
          {series.length === 0 ? (
            <div className="h-full grid place-items-center text-[11px] text-muted-foreground">
              No data
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={series} margin={{ top: 6, right: 4, bottom: 0, left: 0 }}>
                <XAxis
                  dataKey="date"
                  tickFormatter={formatXTick}
                  tick={{ fontSize: 9 }}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={24}
                />
                <YAxis hide />
                <Tooltip
                  contentStyle={{
                    background: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 6,
                    fontSize: 11,
                    padding: '4px 8px',
                  }}
                  labelFormatter={(v) => formatXTick(String(v))}
                  formatter={(value: number | string) => [defaultFormat(Number(value)), title]}
                />
                <Bar dataKey="count" fill={color} radius={[2, 2, 0, 0]} maxBarSize={14} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
