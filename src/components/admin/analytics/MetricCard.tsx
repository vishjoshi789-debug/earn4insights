'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Area, AreaChart, ResponsiveContainer } from 'recharts'
import { cn } from '@/lib/utils'
import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react'

interface MetricCardProps {
  label: string
  value: string                // pre-formatted (caller decides currency / decimals)
  hint?: string                // e.g. "Good >0.2, Great >0.4"
  deltaPct?: number | null     // null = no delta available
  spark?: number[]             // optional sparkline values
  tone?: 'default' | 'positive' | 'warning' | 'critical'
  className?: string
  children?: React.ReactNode   // for richer footer content (e.g. stakeholder pie)
}

export function MetricCard({
  label,
  value,
  hint,
  deltaPct,
  spark,
  tone = 'default',
  className,
  children,
}: MetricCardProps) {
  const toneClass = {
    default: 'text-foreground',
    positive: 'text-emerald-500 dark:text-emerald-400',
    warning: 'text-amber-500 dark:text-amber-400',
    critical: 'text-rose-500 dark:text-rose-400',
  }[tone]

  const deltaTone =
    deltaPct == null
      ? 'text-muted-foreground'
      : deltaPct > 0.5
      ? 'text-emerald-500 dark:text-emerald-400'
      : deltaPct < -0.5
      ? 'text-rose-500 dark:text-rose-400'
      : 'text-muted-foreground'

  const DeltaIcon =
    deltaPct == null
      ? ArrowRight
      : deltaPct > 0.5
      ? ArrowUpRight
      : deltaPct < -0.5
      ? ArrowDownRight
      : ArrowRight

  return (
    <Card className={cn('relative overflow-hidden', className)}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1 min-w-0">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
            <p className={cn('text-2xl font-semibold tabular-nums leading-tight truncate', toneClass)}>
              {value}
            </p>
            {hint && <p className="text-xs text-muted-foreground/80">{hint}</p>}
          </div>
          {deltaPct != null && (
            <div className={cn('flex items-center text-xs font-medium gap-0.5 shrink-0', deltaTone)}>
              <DeltaIcon className="w-3 h-3" />
              <span>{Math.abs(deltaPct).toFixed(1)}%</span>
            </div>
          )}
        </div>

        {children && <div className="mt-3">{children}</div>}

        {spark && spark.length > 1 && (
          <div className="absolute inset-x-0 bottom-0 h-10 opacity-60 pointer-events-none">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={spark.map((v, i) => ({ i, v }))} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id={`sparkFill-${label.replace(/\s+/g, '')}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke="hsl(var(--primary))"
                  strokeWidth={1.5}
                  fill={`url(#sparkFill-${label.replace(/\s+/g, '')})`}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
