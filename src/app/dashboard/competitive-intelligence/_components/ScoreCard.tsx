'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

type Trend = 'improving' | 'stable' | 'declining'

export type ScoreCardProps = {
  category: string
  score: number | null
  rank: number
  totalInCategory: number
  trend: Trend
  previousScore: number | null
}

const TREND_META: Record<Trend, { icon: typeof TrendingUp; className: string; label: string }> = {
  improving: { icon: TrendingUp, className: 'text-emerald-600', label: 'Improving' },
  stable: { icon: Minus, className: 'text-slate-500', label: 'Stable' },
  declining: { icon: TrendingDown, className: 'text-red-600', label: 'Declining' },
}

function bandColor(score: number | null): string {
  if (score === null) return 'bg-slate-200 text-slate-600'
  if (score >= 75) return 'bg-emerald-100 text-emerald-800'
  if (score >= 50) return 'bg-amber-100 text-amber-800'
  return 'bg-red-100 text-red-800'
}

function bandLabel(score: number | null): string {
  if (score === null) return 'Insufficient data'
  if (score >= 75) return 'Strong'
  if (score >= 50) return 'Fair'
  return 'Needs attention'
}

export function ScoreCard({ category, score, rank, totalInCategory, trend, previousScore }: ScoreCardProps) {
  const TrendIcon = TREND_META[trend].icon
  const delta = score !== null && previousScore !== null ? score - previousScore : null

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium capitalize">{category}</CardTitle>
          <Badge variant="secondary" className={bandColor(score)}>
            {bandLabel(score)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-bold tabular-nums">
            {score === null ? '—' : score}
          </span>
          <span className="text-sm text-slate-500">/ 100</span>
          {delta !== null && (
            <span className={`ml-2 text-xs font-medium ${delta > 0 ? 'text-emerald-600' : delta < 0 ? 'text-red-600' : 'text-slate-500'}`}>
              {delta > 0 ? '+' : ''}
              {delta} vs last
            </span>
          )}
        </div>
        <div className="mt-2 flex items-center gap-3 text-xs text-slate-600">
          <span>
            Rank <strong>#{rank}</strong> of {totalInCategory}
          </span>
          <span className="inline-flex items-center gap-1">
            <TrendIcon className={`h-3.5 w-3.5 ${TREND_META[trend].className}`} />
            <span className={TREND_META[trend].className}>{TREND_META[trend].label}</span>
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
