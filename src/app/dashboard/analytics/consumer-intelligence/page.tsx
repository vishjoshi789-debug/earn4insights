'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Users,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  BarChart3,
  Globe,
  Smartphone,
  Activity,
  UserCircle,
  Calendar,
  ShieldCheck,
  Loader2,
  ChevronDown,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────

type SegmentBreakdownItem = {
  segmentKey: string
  segmentValue: string
  userCount: number
  feedbackCount: number
  avgRating: number | null
  avgSentiment: number
  sentimentDistribution: { positive: number; negative: number; neutral: number }
  npsScore: number | null
  topThemes: string[]
  suppressed: boolean
}

type CrossSegmentInsight = {
  insight: string
  severity: 'high' | 'medium' | 'low'
  segment: string
  metric: string
  value: number
}

type ConsumerIntelligenceData = {
  productId: string
  productName: string
  segmentBreakdowns: Record<string, SegmentBreakdownItem[]>
  crossSegmentInsights: CrossSegmentInsight[]
  overallStats: {
    totalRespondents: number
    totalFeedback: number
    avgRating: number | null
    avgSentiment: number
    engagementDistribution: Record<string, number>
  }
  kAnonymityThreshold: number
  computedAt: string
}

type Product = {
  id: string
  name: string
}

// ── Dimension Config ──────────────────────────────────────────────

const DIMENSION_CONFIG = {
  age: { label: 'Age Group', icon: Calendar, color: 'text-blue-400' },
  gender: { label: 'Gender', icon: UserCircle, color: 'text-pink-400' },
  country: { label: 'Geography', icon: Globe, color: 'text-green-400' },
  engagement: { label: 'Engagement Tier', icon: Activity, color: 'text-purple-400' },
  device: { label: 'Device Type', icon: Smartphone, color: 'text-orange-400' },
} as const

// ── Main Component ────────────────────────────────────────────────

export default function ConsumerIntelligencePage() {
  const [products, setProducts] = useState<Product[]>([])
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null)
  const [data, setData] = useState<ConsumerIntelligenceData | null>(null)
  const [loading, setLoading] = useState(false)
  const [productsLoading, setProductsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeDimension, setActiveDimension] = useState<string>('age')

  // Fetch brand's products
  useEffect(() => {
    async function fetchProducts() {
      try {
        // Use the same endpoint as Feature Insights page
        const res = await fetch('/api/admin/check-products')
        if (res.ok) {
          const data = await res.json()
          const uniqueProducts = data.productStats
            ?.filter((p: any, i: number, arr: any[]) => arr.findIndex((t: any) => t.id === p.id) === i)
            ?.map((p: any) => ({ id: p.id, name: p.name })) || []
          setProducts(uniqueProducts)
          if (uniqueProducts.length > 0) {
            setSelectedProduct(uniqueProducts[0].id)
          }
        }
      } catch {
        setError('Failed to load products')
      } finally {
        setProductsLoading(false)
      }
    }
    fetchProducts()
  }, [])

  // Fetch consumer intelligence when product changes
  const fetchIntelligence = useCallback(async (productId: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/analytics/consumer-intelligence/${productId}`)
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || 'Failed to load intelligence')
      }
      const result = await res.json()
      setData(result)
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (selectedProduct) {
      fetchIntelligence(selectedProduct)
    }
  }, [selectedProduct, fetchIntelligence])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-headline font-bold mb-2 flex items-center gap-2">
          <Users className="h-8 w-8 text-purple-500" />
          Consumer Intelligence
        </h1>
        <p className="text-muted-foreground">
          Understand your customers by segment — demographics, engagement, geography & more
        </p>
      </div>

      {/* Privacy badge */}
      <Alert className="bg-green-900/30 border-green-700">
        <ShieldCheck className="h-4 w-4 text-green-400" />
        <AlertTitle className="text-green-200">Privacy Protected</AlertTitle>
        <AlertDescription className="text-green-300">
          All data is aggregated and anonymized. Groups with fewer than 5 users are suppressed to prevent identification.
        </AlertDescription>
      </Alert>

      {/* Product selector */}
      <Card className="border-slate-700" style={{ backgroundColor: '#0f172a' }}>
        <CardContent className="pt-4">
          <label className="text-sm font-medium text-slate-300 block mb-2">Select Product</label>
          {productsLoading ? (
            <div className="flex items-center gap-2 text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading products...
            </div>
          ) : (
            <select
              value={selectedProduct || ''}
              onChange={(e) => setSelectedProduct(e.target.value)}
              className="w-full md:w-96 rounded-md border border-slate-600 bg-slate-800 text-white px-3 py-2"
            >
              {products.length === 0 && <option value="">No products found</option>}
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}
        </CardContent>
      </Card>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
          <span className="ml-3 text-slate-400">Analyzing consumer segments...</span>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Data loaded */}
      {data && !loading && (
        <>
          {/* Overall stats */}
          <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
            <StatCard
              label="Total Respondents"
              value={data.overallStats.totalRespondents}
              icon={Users}
            />
            <StatCard
              label="Total Feedback"
              value={data.overallStats.totalFeedback}
              icon={BarChart3}
            />
            <StatCard
              label="Avg Rating"
              value={data.overallStats.avgRating?.toFixed(1) || 'N/A'}
              icon={Activity}
              suffix="/5"
            />
            <StatCard
              label="Avg Sentiment"
              value={`${data.overallStats.avgSentiment >= 0 ? '+' : ''}${(data.overallStats.avgSentiment * 100).toFixed(0)}%`}
              icon={data.overallStats.avgSentiment >= 0 ? TrendingUp : TrendingDown}
              color={data.overallStats.avgSentiment >= 0 ? 'text-green-400' : 'text-red-400'}
            />
          </div>

          {/* Cross-segment insights */}
          {data.crossSegmentInsights.length > 0 && (
            <Card className="border-slate-700" style={{ backgroundColor: '#0f172a' }}>
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-400" />
                  Key Insights
                </CardTitle>
                <CardDescription>Automatically detected patterns across segments</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.crossSegmentInsights.map((insight, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-lg border ${
                      insight.severity === 'high'
                        ? 'bg-red-900/30 border-red-700'
                        : insight.severity === 'medium'
                        ? 'bg-amber-900/30 border-amber-700'
                        : 'bg-blue-900/30 border-blue-700'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <Badge
                        variant={insight.severity === 'high' ? 'destructive' : 'secondary'}
                        className="shrink-0 mt-0.5"
                      >
                        {insight.severity}
                      </Badge>
                      <p className="text-sm text-slate-200">{insight.insight}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Dimension tabs */}
          <div className="flex gap-2 flex-wrap">
            {Object.entries(DIMENSION_CONFIG).map(([key, config]) => {
              const Icon = config.icon
              return (
                <Button
                  key={key}
                  variant={activeDimension === key ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActiveDimension(key)}
                  className="gap-1"
                >
                  <Icon className="h-4 w-4" />
                  {config.label}
                </Button>
              )
            })}
          </div>

          {/* Segment breakdown table */}
          <SegmentBreakdownTable
            segments={data.segmentBreakdowns[activeDimension] || []}
            dimension={activeDimension}
            kThreshold={data.kAnonymityThreshold}
          />

          {/* Engagement Distribution */}
          {Object.keys(data.overallStats.engagementDistribution).length > 0 && (
            <Card className="border-slate-700" style={{ backgroundColor: '#0f172a' }}>
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Activity className="h-5 w-5 text-purple-400" />
                  Engagement Distribution
                </CardTitle>
                <CardDescription>How engaged are the users providing feedback?</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4 flex-wrap">
                  {Object.entries(data.overallStats.engagementDistribution)
                    .sort(([, a], [, b]) => b - a)
                    .map(([tier, count]) => (
                      <div key={tier} className="text-center">
                        <div className="text-2xl font-bold text-white">{count}</div>
                        <div className="text-xs text-slate-400 capitalize">{tier}</div>
                        <EngagementBadge tier={tier} />
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}

// ── Sub-Components ────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  suffix,
  color,
}: {
  label: string
  value: string | number
  icon: any
  suffix?: string
  color?: string
}) {
  return (
    <Card className="border-slate-700" style={{ backgroundColor: '#0f172a' }}>
      <CardContent className="pt-4">
        <div className="flex items-center gap-2 mb-1">
          <Icon className={`h-4 w-4 ${color || 'text-purple-400'}`} />
          <span className="text-xs text-slate-400">{label}</span>
        </div>
        <div className="text-2xl font-bold text-white">
          {value}{suffix && <span className="text-sm text-slate-400">{suffix}</span>}
        </div>
      </CardContent>
    </Card>
  )
}

function SegmentBreakdownTable({
  segments,
  dimension,
  kThreshold,
}: {
  segments: SegmentBreakdownItem[]
  dimension: string
  kThreshold: number
}) {
  if (segments.length === 0) {
    return (
      <Card className="border-slate-700" style={{ backgroundColor: '#0f172a' }}>
        <CardContent className="py-8 text-center text-slate-400">
          No segment data available for this dimension. Need more feedback with user profiles.
        </CardContent>
      </Card>
    )
  }

  const config = DIMENSION_CONFIG[dimension as keyof typeof DIMENSION_CONFIG]

  return (
    <Card className="border-slate-700" style={{ backgroundColor: '#0f172a' }}>
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <config.icon className={`h-5 w-5 ${config.color}`} />
          {config.label} Breakdown
        </CardTitle>
        <CardDescription>
          Feedback analysis segmented by {config.label.toLowerCase()}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-2 px-3 text-slate-400 font-medium">Segment</th>
                <th className="text-center py-2 px-3 text-slate-400 font-medium">Users</th>
                <th className="text-center py-2 px-3 text-slate-400 font-medium">Feedback</th>
                <th className="text-center py-2 px-3 text-slate-400 font-medium">Rating</th>
                <th className="text-center py-2 px-3 text-slate-400 font-medium">Sentiment</th>
                <th className="text-left py-2 px-3 text-slate-400 font-medium">Distribution</th>
                <th className="text-left py-2 px-3 text-slate-400 font-medium">Top Themes</th>
              </tr>
            </thead>
            <tbody>
              {segments.map((seg) => (
                <tr key={seg.segmentValue} className="border-b border-slate-800 hover:bg-slate-800/50">
                  <td className="py-3 px-3">
                    <span className="font-medium text-white">{seg.segmentValue}</span>
                  </td>
                  <td className="py-3 px-3 text-center">
                    {seg.suppressed ? (
                      <span className="text-slate-500" title={`Below ${kThreshold}-anonymity threshold`}>
                        &lt;{kThreshold}
                      </span>
                    ) : (
                      <span className="text-slate-300">{seg.userCount}</span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-center">
                    {seg.suppressed ? (
                      <span className="text-slate-500">—</span>
                    ) : (
                      <span className="text-slate-300">{seg.feedbackCount}</span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-center">
                    {seg.suppressed || seg.avgRating == null ? (
                      <span className="text-slate-500">—</span>
                    ) : (
                      <span className={seg.avgRating >= 3.5 ? 'text-green-400' : seg.avgRating >= 2.5 ? 'text-amber-400' : 'text-red-400'}>
                        {seg.avgRating.toFixed(1)}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-center">
                    {seg.suppressed ? (
                      <span className="text-slate-500">—</span>
                    ) : (
                      <SentimentBadge value={seg.avgSentiment} />
                    )}
                  </td>
                  <td className="py-3 px-3">
                    {seg.suppressed ? (
                      <span className="text-slate-500">Protected</span>
                    ) : (
                      <SentimentBar distribution={seg.sentimentDistribution} />
                    )}
                  </td>
                  <td className="py-3 px-3">
                    {seg.suppressed ? (
                      <span className="text-slate-500">—</span>
                    ) : (
                      <div className="flex gap-1 flex-wrap">
                        {seg.topThemes.map((theme) => (
                          <Badge key={theme} variant="outline" className="text-xs border-slate-600">
                            {theme}
                          </Badge>
                        ))}
                        {seg.topThemes.length === 0 && (
                          <span className="text-slate-500 text-xs">No themes</span>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

function SentimentBadge({ value }: { value: number }) {
  const percent = Math.round(value * 100)
  const isPositive = percent >= 0
  return (
    <span className={`font-medium ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
      {isPositive ? '+' : ''}{percent}%
    </span>
  )
}

function SentimentBar({ distribution }: { distribution: { positive: number; negative: number; neutral: number } }) {
  const total = distribution.positive + distribution.negative + distribution.neutral
  if (total === 0) return <span className="text-slate-500 text-xs">No data</span>

  const pWidth = (distribution.positive / total) * 100
  const nWidth = (distribution.negative / total) * 100
  const neuWidth = (distribution.neutral / total) * 100

  return (
    <div className="flex h-3 rounded-full overflow-hidden bg-slate-700 min-w-[80px]" title={`+${distribution.positive} / ~${distribution.neutral} / -${distribution.negative}`}>
      {pWidth > 0 && <div className="bg-green-500" style={{ width: `${pWidth}%` }} />}
      {neuWidth > 0 && <div className="bg-slate-400" style={{ width: `${neuWidth}%` }} />}
      {nWidth > 0 && <div className="bg-red-500" style={{ width: `${nWidth}%` }} />}
    </div>
  )
}

function EngagementBadge({ tier }: { tier: string }) {
  const colors: Record<string, string> = {
    power: 'bg-purple-500/20 text-purple-300 border-purple-500',
    active: 'bg-green-500/20 text-green-300 border-green-500',
    casual: 'bg-blue-500/20 text-blue-300 border-blue-500',
    dormant: 'bg-slate-500/20 text-slate-300 border-slate-500',
    new: 'bg-amber-500/20 text-amber-300 border-amber-500',
  }

  return (
    <Badge variant="outline" className={`text-xs mt-1 ${colors[tier.toLowerCase()] || ''}`}>
      {tier}
    </Badge>
  )
}
