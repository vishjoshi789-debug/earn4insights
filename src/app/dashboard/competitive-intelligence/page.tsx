'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Loader2, RefreshCw, Sparkles, ShieldCheck, Users, FileText, Settings } from 'lucide-react'
import { toast } from 'sonner'

import { ScoreCard } from './_components/ScoreCard'
import { DimensionBreakdown } from './_components/DimensionBreakdown'
import { InsightsFeed, type Insight } from './_components/InsightsFeed'
import { AlertFeed, type Alert } from './_components/AlertFeed'
import { RankingsTable, type RankingRow } from './_components/RankingsTable'
import { BenchmarksPanel, type BenchmarkRow } from './_components/BenchmarksPanel'

type Trend = 'improving' | 'stable' | 'declining'

type ScoreByCategory = {
  category: string
  score: number
  rank: number
  totalInCategory: number
  trend: Trend
  previousScore: number | null
  effectiveWeight: number
  breakdown: Record<string, { score: number; weight: number }>
}

type Competitor = {
  id: string
  brandId: string
  competitorName: string
  category: string
  isConfirmed: boolean
  isActive: boolean
}

type RawRanking = {
  brandId: string
  overallScore: number
  rank: number
  trend: Trend
}

type RawBenchmark = {
  metricName: string
  category: string
  brandValue: string | number
  categoryAvg: string | number
  percentile: number | null
  sampleSize: number
  periodStart: string
  periodEnd: string
}

type DashboardPayload = {
  brandId: string
  competitors: Competitor[]
  scoresByCategory: ScoreByCategory[]
  recentAlerts: Alert[]
  recentInsights: Insight[]
  benchmarks: RawBenchmark[]
  rankings: Record<string, RawRanking[]>
}

function byCategory<T extends { category: string }>(rows: T[], category: string): T[] {
  return rows.filter((r) => r.category === category)
}

export default function CompetitiveIntelligencePage() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<DashboardPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [recomputing, setRecomputing] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)

  const fetchDashboard = useCallback(async () => {
    setError(null)
    try {
      const res = await fetch('/api/brand/competitive-intelligence/dashboard', { cache: 'no-store' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `Failed to load dashboard (${res.status})`)
      }
      const json = await res.json()
      const payload = json.dashboard as DashboardPayload
      setData(payload)
      if (payload.scoresByCategory.length > 0) {
        setActiveCategory((prev) => prev ?? payload.scoresByCategory[0].category)
      } else if (payload.competitors.length > 0) {
        setActiveCategory((prev) => prev ?? payload.competitors[0].category)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unexpected error'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDashboard()
  }, [fetchDashboard])

  async function handleRecompute() {
    setRecomputing(true)
    try {
      const res = await fetch('/api/brand/competitive-intelligence/scores/recompute', { method: 'POST' })
      if (res.status === 429) {
        toast.error('Rate limit reached — try again in a minute.')
        return
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Failed to recompute')
      }
      const json = await res.json()
      toast.success(`Recomputed ${json.count ?? 0} categories`)
      await fetchDashboard()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Recompute failed')
    } finally {
      setRecomputing(false)
    }
  }

  async function handleGenerate() {
    setGenerating(true)
    try {
      const res = await fetch('/api/brand/competitive-intelligence/insights/generate', { method: 'POST' })
      if (res.status === 429) {
        toast.error('AI generation is rate-limited — try again in a minute.')
        return
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Failed to generate insights')
      }
      const json = await res.json()
      const generated = json.generated ?? 0
      const skipped = (json.skipped ?? []) as Array<{ category: string; reason: string }>
      if (generated > 0) {
        toast.success(`Generated ${generated} insight${generated === 1 ? '' : 's'}`)
      } else if (skipped.some((s) => s.reason === 'daily_cap_reached')) {
        toast.info('Daily insight cap (3/brand) reached. Try again tomorrow.')
      } else if (skipped.some((s) => s.reason === 'no_active_competitors')) {
        toast.info('Add active competitors to generate insights.')
      } else {
        toast.info('No new insights — idempotency window still active.')
      }
      await fetchDashboard()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Insight generation failed')
    } finally {
      setGenerating(false)
    }
  }

  const categories = useMemo<string[]>(() => {
    if (!data) return []
    const set = new Set<string>()
    data.scoresByCategory.forEach((s) => set.add(s.category))
    data.competitors.forEach((c) => set.add(c.category))
    return Array.from(set)
  }, [data])

  if (loading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-64" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="space-y-3 py-8 text-center">
            <p className="text-sm text-red-600">{error}</p>
            <Button variant="outline" onClick={fetchDashboard}>Retry</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!data) return null

  const hasCompetitors = data.competitors.length > 0

  const selectedScore = activeCategory
    ? data.scoresByCategory.find((s) => s.category === activeCategory) ?? null
    : null
  const selectedRankings = activeCategory ? data.rankings[activeCategory] ?? [] : []
  const selectedBenchmarks = activeCategory ? byCategory(data.benchmarks, activeCategory) : []

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Competitive intelligence</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Aggregate intelligence across your tracked competitors. Cohorts below 5 are not shown to
            protect consumer privacy — no individuals or raw feedback ever appear here.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/competitive-intelligence/competitors">
              <Users className="mr-2 h-4 w-4" />
              Manage competitors
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/competitive-intelligence/reports">
              <FileText className="mr-2 h-4 w-4" />
              Reports
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/competitive-intelligence/settings">
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </Link>
          </Button>
          <Button variant="outline" size="sm" onClick={handleRecompute} disabled={recomputing}>
            {recomputing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Recompute scores
          </Button>
          <Button size="sm" onClick={handleGenerate} disabled={generating}>
            {generating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            Generate AI insights
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
        <ShieldCheck className="h-4 w-4 text-emerald-600" />
        <span>
          Privacy floor: min cohort 5. Daily AI cap: 3 insights per brand. Competitor names shown
          only for brands you explicitly track.
        </span>
      </div>

      {!hasCompetitors ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add competitors to get started</CardTitle>
            <CardDescription>
              Track brands you compete with to unlock scores, alerts, and daily AI insights.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-start gap-3 py-6 text-sm text-slate-500">
            No competitors tracked yet.
            <Button asChild size="sm">
              <Link href="/dashboard/competitive-intelligence/competitors">Add your first competitor</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {data.scoresByCategory.length === 0 ? (
            <Card>
              <CardContent className="py-6 text-sm text-slate-500">
                Scores have not been computed yet. Click <strong>Recompute scores</strong> above.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {data.scoresByCategory.map((s) => (
                <ScoreCard
                  key={s.category}
                  category={s.category}
                  score={s.score}
                  rank={s.rank}
                  totalInCategory={s.totalInCategory}
                  trend={s.trend}
                  previousScore={s.previousScore}
                />
              ))}
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <AlertFeed initial={data.recentAlerts} />
            <InsightsFeed initial={data.recentInsights} />
          </div>

          {categories.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Category deep dive</CardTitle>
                <CardDescription>Score breakdown, rankings, and benchmarks per tracked category.</CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs
                  value={activeCategory ?? categories[0]}
                  onValueChange={setActiveCategory}
                  className="space-y-4"
                >
                  <TabsList className="flex-wrap">
                    {categories.map((cat) => (
                      <TabsTrigger key={cat} value={cat} className="capitalize">
                        {cat}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  {categories.map((cat) => (
                    <TabsContent key={cat} value={cat} className="space-y-4">
                      {selectedScore && cat === activeCategory ? (
                        <DimensionBreakdown
                          breakdown={selectedScore.breakdown}
                          effectiveWeight={selectedScore.effectiveWeight}
                        />
                      ) : cat === activeCategory ? (
                        <Card>
                          <CardContent className="py-6 text-sm text-slate-500">
                            No score yet for {cat}. Run recompute.
                          </CardContent>
                        </Card>
                      ) : null}
                      {cat === activeCategory && (
                        <div className="grid gap-4 lg:grid-cols-2">
                          <RankingsTable
                            category={cat}
                            rows={(selectedRankings as RawRanking[]).map((r): RankingRow => ({
                              brandId: r.brandId,
                              overallScore: r.overallScore,
                              rank: r.rank,
                              trend: r.trend,
                            }))}
                            selfBrandId={data.brandId}
                          />
                          <BenchmarksPanel
                            rows={selectedBenchmarks.map((b): BenchmarkRow => ({
                              metricName: b.metricName,
                              brandValue: b.brandValue,
                              categoryAvg: b.categoryAvg,
                              percentile: b.percentile,
                              sampleSize: b.sampleSize,
                              periodStart: b.periodStart,
                              periodEnd: b.periodEnd,
                            }))}
                          />
                        </div>
                      )}
                    </TabsContent>
                  ))}
                </Tabs>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
