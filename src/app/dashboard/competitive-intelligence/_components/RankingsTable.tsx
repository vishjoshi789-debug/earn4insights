'use client'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export type RankingRow = {
  brandId: string
  overallScore: number
  rank: number
  trend: 'improving' | 'stable' | 'declining'
}

export function RankingsTable({
  category,
  rows,
  selfBrandId,
}: {
  category: string
  rows: RankingRow[]
  selfBrandId: string
}) {
  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-sm text-slate-500">
          No ranking data yet for {category}.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base capitalize">{category} ranking</CardTitle>
        <CardDescription>Top brands in this category by competitive score.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="divide-y">
          {rows.map((r, idx) => {
            const self = r.brandId === selfBrandId
            return (
              <div
                key={r.brandId + idx}
                className={`flex items-center justify-between py-2 ${self ? 'rounded bg-blue-50 px-2 font-semibold' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs tabular-nums">
                    {idx + 1}
                  </span>
                  <span className="text-sm text-slate-700">
                    {self ? 'Your brand' : `brand ${r.brandId.slice(0, 8)}…`}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="tabular-nums text-sm">{r.overallScore}</span>
                  <Badge variant="secondary" className="text-[10px] capitalize">
                    {r.trend}
                  </Badge>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
