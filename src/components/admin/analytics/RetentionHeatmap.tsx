'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { RetentionData, UserRole } from '@/lib/types/platformAnalytics'

interface Props {
  initial: RetentionData
}

const ROLE_TABS: { value: UserRole; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'brand', label: 'Brands' },
  { value: 'consumer', label: 'Consumers' },
  { value: 'influencer', label: 'Influencers' },
]

const DAY_COLS: Array<{ key: keyof RetentionData['cohorts'][number]; label: string }> = [
  { key: 'day1', label: 'D1' },
  { key: 'day7', label: 'D7' },
  { key: 'day14', label: 'D14' },
  { key: 'day30', label: 'D30' },
  { key: 'day60', label: 'D60' },
  { key: 'day90', label: 'D90' },
]

function heatColor(pct: number | null): string {
  if (pct == null) return 'bg-muted/30 text-muted-foreground'
  // 5-band emerald scale. Avoid pure transparency so dark mode still reads.
  if (pct >= 70) return 'bg-emerald-600/90 text-white'
  if (pct >= 50) return 'bg-emerald-500/70 text-white'
  if (pct >= 30) return 'bg-emerald-400/55 text-foreground'
  if (pct >= 15) return 'bg-emerald-300/40 text-foreground'
  return 'bg-emerald-200/25 text-foreground'
}

function formatCohortDate(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function RetentionHeatmap({ initial }: Props) {
  const [role, setRole] = useState<UserRole>(initial.role)
  const [data, setData] = useState<RetentionData>(initial)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (role === initial.role) {
      setData(initial)
      return
    }
    let cancelled = false
    setLoading(true)
    fetch(`/api/admin/platform-analytics/retention?role=${role}`, { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then((d: RetentionData) => {
        if (!cancelled) setData(d)
      })
      .catch((err) => {
        console.error('[RetentionHeatmap] fetch failed', err)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [role, initial])

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">Retention cohorts</CardTitle>
          <div className="inline-flex rounded-md border border-border bg-card p-0.5">
            {ROLE_TABS.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setRole(t.value)}
                disabled={loading}
                className={cn(
                  'px-2.5 py-1 text-xs font-medium rounded-sm transition-colors',
                  t.value === role
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                  loading && 'opacity-50 cursor-not-allowed',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground pt-1">
          Day 1: <span className="text-foreground font-medium">{fmt(data.avgDay1)}</span> &middot;
          {' '}Day 7: <span className="text-foreground font-medium">{fmt(data.avgDay7)}</span> &middot;
          {' '}Day 30: <span className="text-foreground font-medium">{fmt(data.avgDay30)}</span>
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted-foreground">
                <th className="text-left font-medium px-3 py-2">Cohort</th>
                <th className="text-right font-medium px-2 py-2">Size</th>
                {DAY_COLS.map((c) => (
                  <th key={c.key} className="text-center font-medium px-2 py-2">{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.cohorts.length === 0 ? (
                <tr>
                  <td colSpan={2 + DAY_COLS.length} className="px-3 py-8 text-center text-muted-foreground">
                    No cohorts yet — first weekly run will populate.
                  </td>
                </tr>
              ) : (
                data.cohorts.map((row) => (
                  <tr key={row.cohortDate} className="border-t border-border/50">
                    <td className="px-3 py-2 text-foreground whitespace-nowrap">{formatCohortDate(row.cohortDate)}</td>
                    <td className="px-2 py-2 text-right text-muted-foreground tabular-nums">{row.cohortSize}</td>
                    {DAY_COLS.map((c) => {
                      const v = row[c.key] as number | null
                      return (
                        <td key={c.key} className="px-1 py-1">
                          <div className={cn('rounded-sm text-center tabular-nums px-1 py-1.5', heatColor(v))}>
                            {v == null ? '—' : `${v.toFixed(0)}%`}
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

function fmt(v: number | null): string {
  return v == null ? '—' : `${v.toFixed(1)}%`
}
