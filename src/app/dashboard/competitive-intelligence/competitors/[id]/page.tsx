'use client'

import { use, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft, ExternalLink, TrendingDown, TrendingUp, Minus, Package } from 'lucide-react'
import { toast } from 'sonner'

type Competitor = {
  id: string
  brandId: string
  competitorName: string
  competitorType: 'on_platform' | 'off_platform'
  competitorWebsite: string | null
  category: string
  isSystemSuggested: boolean
  isConfirmed: boolean
  isActive: boolean
  notes: string | null
  createdAt: string
}

type Product = {
  id: string
  productName: string
  category: string
  description: string | null
  currentPrice: number | null
  currency: string | null
  priceUpdatedAt: string | null
  positioning: string | null
  targetSegment: string | null
  externalUrl: string | null
}

type PriceHistoryRow = {
  id: string
  price: number
  currency: string
  source: string
  recordedAt: string
}

type DashboardScore = {
  category: string
  score: number
  rank: number
  totalInCategory: number
  trend: 'improving' | 'stable' | 'declining'
  previousScore: number | null
}

function formatMoney(paise: number | null, currency: string | null): string {
  if (paise === null) return '—'
  const value = paise / 100
  const code = currency || 'INR'
  try {
    return new Intl.NumberFormat(code === 'INR' ? 'en-IN' : 'en-US', {
      style: 'currency', currency: code, maximumFractionDigits: 2,
    }).format(value)
  } catch {
    return `${code} ${value.toFixed(2)}`
  }
}

function trendIcon(t: DashboardScore['trend']) {
  if (t === 'improving') return <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
  if (t === 'declining') return <TrendingDown className="h-3.5 w-3.5 text-red-600" />
  return <Minus className="h-3.5 w-3.5 text-slate-500" />
}

export default function CompetitorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [competitor, setCompetitor] = useState<Competitor | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [dashboardScore, setDashboardScore] = useState<DashboardScore | null>(null)
  const [priceHistory, setPriceHistory] = useState<Record<string, PriceHistoryRow[]>>({})

  const fetchAll = useCallback(async () => {
    try {
      const [compRes, prodRes, dashRes] = await Promise.all([
        fetch(`/api/brand/competitive-intelligence/competitors/${id}`, { cache: 'no-store' }),
        fetch(`/api/brand/competitive-intelligence/competitors/${id}/products?activeOnly=true`, { cache: 'no-store' }),
        fetch('/api/brand/competitive-intelligence/dashboard', { cache: 'no-store' }),
      ])
      if (compRes.status === 404) {
        setNotFound(true)
        return
      }
      if (!compRes.ok) throw new Error('Failed to load competitor')
      const compJson = await compRes.json()
      const comp: Competitor = compJson.competitor
      setCompetitor(comp)
      const prodJson = prodRes.ok ? await prodRes.json() : { products: [] }
      setProducts(prodJson.products ?? [])
      if (dashRes.ok) {
        const dashJson = await dashRes.json()
        const match = (dashJson.dashboard?.scoresByCategory ?? []).find(
          (s: DashboardScore) => s.category === comp.category
        )
        setDashboardScore(match ?? null)
      }
    } catch {
      toast.error('Failed to load competitor details')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  useEffect(() => {
    if (products.length === 0) return
    let cancelled = false
    ;(async () => {
      const entries: Array<[string, PriceHistoryRow[]]> = []
      for (const p of products) {
        const res = await fetch(
          `/api/brand/competitive-intelligence/competitors/${id}/products/${p.id}/price-history?days=90`,
          { cache: 'no-store' }
        )
        if (res.ok) {
          const json = await res.json()
          entries.push([p.id, json.history ?? []])
        }
      }
      if (!cancelled) setPriceHistory(Object.fromEntries(entries))
    })()
    return () => { cancelled = true }
  }, [id, products])

  const priceRange = useMemo(() => {
    const prices = products.map((p) => p.currentPrice).filter((v): v is number => v !== null)
    if (prices.length === 0) return null
    return { min: Math.min(...prices), max: Math.max(...prices), count: prices.length }
  }, [products])

  if (loading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32" />
        <Skeleton className="h-48" />
      </div>
    )
  }

  if (notFound || !competitor) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="space-y-3 py-8 text-center">
            <p className="text-sm text-slate-600">This competitor is not available.</p>
            <Button asChild variant="outline">
              <Link href="/dashboard/competitive-intelligence/competitors">Back to list</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <Link
          href="/dashboard/competitive-intelligence/competitors"
          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> All competitors
        </Link>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{competitor.competitorName}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
              <Badge variant="secondary" className="capitalize">{competitor.category}</Badge>
              <span>{competitor.competitorType === 'on_platform' ? 'On platform' : 'Off platform'}</span>
              {competitor.isConfirmed ? (
                <Badge variant="secondary" className="bg-emerald-100 text-emerald-800">Confirmed</Badge>
              ) : (
                <Badge variant="secondary" className="bg-amber-100 text-amber-800">Unconfirmed</Badge>
              )}
              {competitor.competitorWebsite && (
                <a
                  href={competitor.competitorWebsite}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 hover:text-slate-700"
                >
                  {competitor.competitorWebsite.replace(/^https?:\/\//, '')}
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Your position in {competitor.category}</CardTitle>
          </CardHeader>
          <CardContent>
            {dashboardScore ? (
              <>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold tabular-nums">{dashboardScore.score}</span>
                  <span className="text-xs text-slate-500">/ 100</span>
                </div>
                <div className="mt-1 flex items-center gap-2 text-xs text-slate-600">
                  <span>Rank #{dashboardScore.rank} of {dashboardScore.totalInCategory}</span>
                  <span className="inline-flex items-center gap-1">
                    {trendIcon(dashboardScore.trend)}
                    <span className="capitalize">{dashboardScore.trend}</span>
                  </span>
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-500">No score computed for this category yet.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Tracked products</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold tabular-nums">{products.length}</span>
              <span className="text-xs text-slate-500">active</span>
            </div>
            {priceRange && (
              <p className="mt-1 text-xs text-slate-600">
                Price range {formatMoney(priceRange.min, products[0]?.currency ?? 'INR')} –{' '}
                {formatMoney(priceRange.max, products[0]?.currency ?? 'INR')}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Tracking since</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-semibold">
              {new Date(competitor.createdAt).toLocaleDateString()}
            </div>
            {competitor.notes && (
              <p className="mt-1 line-clamp-2 text-xs text-slate-500">{competitor.notes}</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Products</CardTitle>
          <CardDescription>
            Products you track for this competitor. Price history is retained for 90 days.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {products.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-sm text-slate-500">
              <Package className="h-6 w-6 text-slate-400" />
              No products tracked yet for this competitor.
            </div>
          ) : (
            <div className="divide-y">
              {products.map((p) => {
                const history = priceHistory[p.id] ?? []
                const first = history[history.length - 1]
                const delta = first && p.currentPrice !== null ? p.currentPrice - first.price : null
                return (
                  <div key={p.id} className="py-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="font-medium text-slate-900">{p.productName}</div>
                        {p.description && (
                          <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{p.description}</p>
                        )}
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                          <Badge variant="secondary" className="capitalize">{p.category}</Badge>
                          {p.positioning && <span>{p.positioning}</span>}
                          {p.targetSegment && <span>· {p.targetSegment}</span>}
                          {p.externalUrl && (
                            <a
                              href={p.externalUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 hover:text-slate-700"
                            >
                              product page <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-semibold tabular-nums">
                          {formatMoney(p.currentPrice, p.currency)}
                        </div>
                        {delta !== null && delta !== 0 && (
                          <div className={`text-xs ${delta > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                            {delta > 0 ? '+' : ''}{formatMoney(delta, p.currency)} vs 90d ago
                          </div>
                        )}
                        {p.priceUpdatedAt && (
                          <div className="text-[11px] text-slate-400">
                            updated {new Date(p.priceUpdatedAt).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
        <strong>Privacy reminder:</strong> No individual consumer data or raw feedback is ever
        attributed to this competitor. All comparisons use cohort aggregates ≥ 5.
      </div>
    </div>
  )
}
