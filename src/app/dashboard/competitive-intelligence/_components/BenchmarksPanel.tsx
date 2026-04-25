'use client'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const METRIC_LABELS: Record<string, string> = {
  avg_sentiment: 'Sentiment',
  market_share: 'Market Share',
  avg_price: 'Average Price',
  feature_coverage: 'Feature Coverage',
  influencer_reach: 'Influencer Reach',
  consumer_loyalty: 'Consumer Loyalty',
  avg_rating: 'Avg Rating',
  feedback_volume: 'Feedback Volume',
  deal_count: 'Deals',
  engagement_rate: 'Engagement',
  complaint_rate: 'Complaint Rate',
  nps_estimate: 'NPS (est.)',
}

export type BenchmarkRow = {
  metricName: string
  brandValue: string | number
  categoryAvg: string | number
  percentile: number | null
  sampleSize: number
  periodStart: string
  periodEnd: string
}

function fmtValue(v: string | number): string {
  const n = typeof v === 'string' ? parseFloat(v) : v
  if (Number.isNaN(n)) return String(v)
  if (Math.abs(n) >= 1000) return n.toLocaleString()
  return n.toFixed(2)
}

export function BenchmarksPanel({ rows }: { rows: BenchmarkRow[] }) {
  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-sm text-slate-500">
          No benchmarks computed yet. Run a score recompute to populate.
        </CardContent>
      </Card>
    )
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Benchmarks</CardTitle>
        <CardDescription>Your metric vs category average.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {rows.map((r, idx) => {
            const brandN = parseFloat(String(r.brandValue))
            const catN = parseFloat(String(r.categoryAvg))
            const ahead = brandN >= catN
            return (
              <div key={idx} className="rounded border p-2.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-700">{METRIC_LABELS[r.metricName] ?? r.metricName}</span>
                  {r.percentile !== null && (
                    <Badge variant="secondary" className="text-xs tabular-nums">
                      P{r.percentile}
                    </Badge>
                  )}
                </div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-lg font-semibold tabular-nums">{fmtValue(r.brandValue)}</span>
                  <span className={`text-xs ${ahead ? 'text-emerald-600' : 'text-red-600'}`}>
                    vs {fmtValue(r.categoryAvg)} avg
                  </span>
                </div>
                <div className="mt-0.5 text-[11px] text-slate-400">
                  n={r.sampleSize} · {r.periodStart} → {r.periodEnd}
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
