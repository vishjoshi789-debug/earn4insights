'use client'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'

const DIMENSION_LABELS: Record<string, string> = {
  sentiment: 'Sentiment',
  marketShare: 'Market Share',
  pricing: 'Pricing',
  featureCoverage: 'Feature Coverage',
  influencerReach: 'Influencer Reach',
  consumerLoyalty: 'Consumer Loyalty',
}

export type DimensionBreakdownProps = {
  breakdown: Record<string, { score: number; weight: number }>
  effectiveWeight?: number
}

export function DimensionBreakdown({ breakdown, effectiveWeight }: DimensionBreakdownProps) {
  const entries = Object.entries(DIMENSION_LABELS)
  const missing = entries.filter(([k]) => (breakdown[k]?.weight ?? 0) === 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Score breakdown</CardTitle>
        <CardDescription>
          Six weighted dimensions make up the overall score.
          {effectiveWeight !== undefined && effectiveWeight < 100 && (
            <span className="block text-amber-700">
              {effectiveWeight}% effective weight — dimensions without enough cohort data are excluded, not penalised.
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {entries.map(([key, label]) => {
          const d = breakdown[key]
          const hasData = d && d.weight > 0
          return (
            <div key={key}>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-700">{label}</span>
                {hasData ? (
                  <span className="tabular-nums text-slate-900">
                    <strong>{d.score}</strong>
                    <span className="text-slate-400"> · weight {d.weight}</span>
                  </span>
                ) : (
                  <span className="text-xs text-slate-400">no data</span>
                )}
              </div>
              <Progress value={hasData ? d.score : 0} className="mt-1 h-1.5" />
            </div>
          )
        })}
        {missing.length > 0 && (
          <p className="pt-2 text-xs text-slate-500">
            Dimensions without enough data ({missing.map(([, l]) => l).join(', ')}) are omitted from the score.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
