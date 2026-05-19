'use client'

import { useState } from 'react'
import { Area, AreaChart, BarChart, Bar, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { UserGrowth } from '@/lib/types/platformAnalytics'

interface Props {
  data: UserGrowth
}

type Mode = 'cumulative' | 'new'

const COLORS = {
  brands: '#6366f1',      // indigo
  consumers: '#10b981',   // emerald
  influencers: '#8b5cf6', // violet
  total: 'hsl(var(--muted-foreground))',
  newUsers: 'hsl(var(--primary))',
}

function PctPill({ label, value }: { label: string; value: number }) {
  const tone =
    value > 0.5
      ? 'text-emerald-500'
      : value < -0.5
      ? 'text-rose-500'
      : 'text-muted-foreground'
  const sign = value > 0 ? '+' : ''
  return (
    <div className="flex items-baseline gap-1">
      <span className="text-xs text-muted-foreground uppercase tracking-wider">{label}</span>
      <span className={cn('text-sm font-semibold tabular-nums', tone)}>
        {sign}
        {value.toFixed(1)}%
      </span>
    </div>
  )
}

function formatXTick(value: string): string {
  // value is ISO yyyy-MM-dd
  const d = new Date(value)
  if (isNaN(d.getTime())) return value
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function UserGrowthChart({ data }: Props) {
  const [mode, setMode] = useState<Mode>('cumulative')

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-base">User growth</CardTitle>
        <div className="inline-flex rounded-md border border-border bg-card p-0.5">
          {(['cumulative', 'new'] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn(
                'px-3 py-1 text-xs font-medium rounded-sm transition-colors',
                m === mode
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {m === 'cumulative' ? 'Cumulative' : 'New signups'}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="h-[260px]">
          {data.series.length === 0 ? (
            <EmptyState />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              {mode === 'cumulative' ? (
                <AreaChart data={data.series}>
                  <defs>
                    <linearGradient id="ugBrands" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={COLORS.brands} stopOpacity={0.5} />
                      <stop offset="100%" stopColor={COLORS.brands} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="ugConsumers" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={COLORS.consumers} stopOpacity={0.5} />
                      <stop offset="100%" stopColor={COLORS.consumers} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="ugInfluencers" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={COLORS.influencers} stopOpacity={0.5} />
                      <stop offset="100%" stopColor={COLORS.influencers} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tickFormatter={formatXTick} tick={{ fontSize: 11 }} minTickGap={32} />
                  <YAxis tick={{ fontSize: 11 }} width={48} />
                  <Tooltip
                    contentStyle={{
                      background: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 6,
                      fontSize: 12,
                    }}
                    labelFormatter={(v) => formatXTick(String(v))}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Area name="Brands" type="monotone" dataKey="brands" stackId="1" stroke={COLORS.brands} fill="url(#ugBrands)" />
                  <Area name="Consumers" type="monotone" dataKey="consumers" stackId="1" stroke={COLORS.consumers} fill="url(#ugConsumers)" />
                  <Area name="Influencers" type="monotone" dataKey="influencers" stackId="1" stroke={COLORS.influencers} fill="url(#ugInfluencers)" />
                </AreaChart>
              ) : (
                <BarChart data={data.series}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tickFormatter={formatXTick} tick={{ fontSize: 11 }} minTickGap={32} />
                  <YAxis tick={{ fontSize: 11 }} width={36} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      background: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 6,
                      fontSize: 12,
                    }}
                    labelFormatter={(v) => formatXTick(String(v))}
                  />
                  <Bar name="New signups" dataKey="newUsers" fill={COLORS.newUsers} radius={[2, 2, 0, 0]} />
                </BarChart>
              )}
            </ResponsiveContainer>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 pt-1 border-t border-border">
          <PctPill label="WoW" value={data.wowPct} />
          <PctPill label="MoM" value={data.momPct} />
          <PctPill label="QoQ" value={data.qoqPct} />
        </div>
      </CardContent>
    </Card>
  )
}

function EmptyState() {
  return (
    <div className="h-full grid place-items-center text-xs text-muted-foreground">
      Collecting data — chart fills as the daily cron runs.
    </div>
  )
}
