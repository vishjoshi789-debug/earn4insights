'use client'

import { Card, CardContent } from '@/components/ui/card'
import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { HealthScore } from '@/lib/types/platformAnalytics'

interface Props {
  score: HealthScore
  className?: string
}

const BAND_COPY = {
  healthy: { label: 'Healthy', stroke: 'stroke-emerald-500', text: 'text-emerald-500' },
  attention: { label: 'Needs attention', stroke: 'stroke-amber-500', text: 'text-amber-500' },
  critical: { label: 'Critical', stroke: 'stroke-rose-500', text: 'text-rose-500' },
} as const

export function HealthScoreGauge({ score, className }: Props) {
  const band = BAND_COPY[score.band]
  const TrendIcon =
    score.trend === 'improving' ? ArrowUpRight : score.trend === 'declining' ? ArrowDownRight : ArrowRight
  const trendTone =
    score.trend === 'improving'
      ? 'text-emerald-500'
      : score.trend === 'declining'
      ? 'text-rose-500'
      : 'text-muted-foreground'

  // SVG gauge geometry
  const size = 168
  const stroke = 14
  const r = (size - stroke) / 2
  const cx = size / 2
  const cy = size / 2
  // Half-circle gauge — 180° arc from 9 o'clock to 3 o'clock
  const startAngle = 180
  const endAngle = 360
  const circumference = Math.PI * r // half circle
  const clamped = Math.max(0, Math.min(100, score.score))
  const filled = (clamped / 100) * circumference
  const trackDash = `${circumference} ${circumference}`
  const valueDash = `${filled} ${circumference}`

  const polarToCartesian = (angle: number) => {
    const rad = ((angle - 90) * Math.PI) / 180
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
  }
  const trackStart = polarToCartesian(startAngle)
  const trackEnd = polarToCartesian(endAngle)
  const arc = (start: { x: number; y: number }, end: { x: number; y: number }) =>
    `M ${start.x} ${start.y} A ${r} ${r} 0 0 1 ${end.x} ${end.y}`

  return (
    <Card className={cn('lg:col-span-2', className)}>
      <CardContent className="p-5 flex flex-col items-center justify-between gap-3 h-full">
        <div className="w-full flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Platform Health</p>
          <div className={cn('flex items-center text-xs font-medium gap-0.5', trendTone)}>
            <TrendIcon className="w-3 h-3" />
            <span>{Math.abs(score.trendDeltaPct).toFixed(1)}% vs 7d</span>
          </div>
        </div>

        <div className="relative" style={{ width: size, height: size / 2 + 24 }}>
          <svg
            viewBox={`0 0 ${size} ${size / 2 + 8}`}
            width={size}
            height={size / 2 + 8}
            className="overflow-visible"
            aria-hidden
          >
            {/* Track */}
            <path
              d={arc(trackStart, trackEnd)}
              fill="none"
              strokeWidth={stroke}
              strokeLinecap="round"
              className="stroke-muted"
              strokeDasharray={trackDash}
            />
            {/* Value arc */}
            <path
              d={arc(trackStart, trackEnd)}
              fill="none"
              strokeWidth={stroke}
              strokeLinecap="round"
              className={cn('transition-all duration-500', band.stroke)}
              strokeDasharray={valueDash}
            />
          </svg>
          <div className="absolute inset-x-0 top-2 flex flex-col items-center justify-center">
            <span className={cn('text-4xl font-semibold tabular-nums leading-none', band.text)}>
              {clamped}
            </span>
            <span className={cn('text-xs font-medium mt-1', band.text)}>{band.label}</span>
          </div>
        </div>

        <ul className="w-full grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          {score.factors.map((f) => (
            <li key={f.key} className="flex items-center justify-between gap-2">
              <span className="truncate">{f.label}</span>
              <span className="font-medium tabular-nums text-foreground">{f.value}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
