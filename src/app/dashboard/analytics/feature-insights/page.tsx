'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Activity, TrendingUp, TrendingDown, Minus, BarChart3, MessageSquare, ThumbsUp, ThumbsDown, Heart, Shield, Zap, RefreshCw } from 'lucide-react'
import type { FeatureSentimentResult, FeatureSentimentEntry } from '@/lib/analytics/featureSentiment'
import type { ProductHealthResult } from '@/lib/analytics/productHealthScore'

export default function FeatureInsightsPage() {
  const [products, setProducts] = useState<Array<{ id: string; name: string }>>([])
  const [selectedProduct, setSelectedProduct] = useState<string>('')
  const [featureData, setFeatureData] = useState<FeatureSentimentResult | null>(null)
  const [healthData, setHealthData] = useState<ProductHealthResult | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadProducts()
  }, [])

  useEffect(() => {
    if (selectedProduct) {
      loadData(selectedProduct)
    }
  }, [selectedProduct])

  const loadProducts = async () => {
    try {
      const res = await fetch('/api/admin/check-products')
      if (res.ok) {
        const data = await res.json()
        const uniqueProducts = data.productStats
          ?.filter((p: any, i: number, arr: any[]) => arr.findIndex((t: any) => t.id === p.id) === i)
          ?.map((p: any) => ({ id: p.id, name: p.name })) || []
        setProducts(uniqueProducts)
        if (uniqueProducts.length > 0 && !selectedProduct) {
          setSelectedProduct(uniqueProducts[0].id)
        }
      }
    } catch (err) {
      console.error('Failed to load products:', err)
    }
  }

  const loadData = async (productId: string) => {
    setLoading(true)
    try {
      const [featureRes, healthRes] = await Promise.all([
        fetch(`/api/analytics/feature-sentiment/${productId}`),
        fetch(`/api/analytics/health-score/${productId}`),
      ])

      if (featureRes.ok) setFeatureData(await featureRes.json())
      if (healthRes.ok) setHealthData(await healthRes.json())
    } catch (err) {
      console.error('Failed to load analytics:', err)
    } finally {
      setLoading(false)
    }
  }

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'A': return 'text-green-500'
      case 'B': return 'text-blue-500'
      case 'C': return 'text-yellow-500'
      case 'D': return 'text-orange-500'
      case 'F': return 'text-red-500'
      default: return 'text-muted-foreground'
    }
  }

  const getTrendIcon = (direction: string) => {
    switch (direction) {
      case 'up': case 'improving': return <TrendingUp className="h-4 w-4 text-green-500" />
      case 'down': case 'declining': return <TrendingDown className="h-4 w-4 text-red-500" />
      default: return <Minus className="h-4 w-4 text-muted-foreground" />
    }
  }

  return (
    <div className="container mx-auto px-4 py-6 sm:p-6 space-y-6 max-w-full overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <Activity className="h-7 w-7 sm:h-8 sm:w-8 text-purple-500" />
            Feature Insights
          </h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">
            Deep-dive into what users say about each product feature
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Select value={selectedProduct} onValueChange={setSelectedProduct}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select product" />
            </SelectTrigger>
            <SelectContent>
              {products.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            onClick={() => selectedProduct && loadData(selectedProduct)}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {loading && (
        <div className="text-center py-12 text-muted-foreground">
          <RefreshCw className="h-8 w-8 mx-auto animate-spin mb-2" />
          Analyzing features...
        </div>
      )}

      {!loading && healthData && (
        <>
          {/* Health Score Card */}
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-4">
            <Card className="sm:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Product Health Score</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <div className={`text-5xl font-bold ${getGradeColor(healthData.grade)}`}>
                    {healthData.healthScore}
                  </div>
                  <div>
                    <Badge variant="outline" className="text-lg px-3 py-1">
                      Grade {healthData.grade}
                    </Badge>
                    <div className="flex items-center gap-1 mt-1 text-sm text-muted-foreground">
                      {getTrendIcon(healthData.trend)} {healthData.trend}
                    </div>
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  {Object.entries(healthData.breakdown).map(([key, val]) => (
                    <div key={key} className="flex items-center gap-2 text-sm">
                      <span className="w-24 text-muted-foreground capitalize">{key}</span>
                      <Progress value={val.score * 100} className="flex-1 h-2" />
                      <span className="w-12 text-right font-mono text-xs">
                        {(val.score * 100).toFixed(0)}%
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Data Points</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{healthData.dataPoints}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  feedback + survey responses
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Features Detected</CardTitle>
                <Zap className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{featureData?.features.length || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  from {featureData?.totalTextsAnalyzed || 0} texts
                </p>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* Feature Breakdown */}
      {!loading && featureData && featureData.features.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Feature Sentiment Breakdown</CardTitle>
            <CardDescription>
              What users are saying about each product feature
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {featureData.features.map((feature) => (
              <FeatureCard key={feature.feature} feature={feature} />
            ))}
          </CardContent>
        </Card>
      )}

      {!loading && featureData && featureData.features.length === 0 && selectedProduct && (
        <Card>
          <CardContent className="text-center py-12 text-muted-foreground">
            <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">No feature mentions detected yet</p>
            <p className="text-sm mt-2">Collect more feedback to see feature-level insights</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function FeatureCard({ feature }: { feature: FeatureSentimentEntry }) {
  const total = feature.sentiment.positive + feature.sentiment.negative + feature.sentiment.neutral
  const positivePercent = total > 0 ? (feature.sentiment.positive / total) * 100 : 0
  const negativePercent = total > 0 ? (feature.sentiment.negative / total) * 100 : 0

  const sentimentColor =
    feature.sentiment.score > 0.2 ? 'text-green-500' :
    feature.sentiment.score < -0.2 ? 'text-red-500' : 'text-yellow-500'

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold">{feature.feature}</h3>
          <Badge variant="outline" className="text-xs">
            {feature.mentionCount} mentions
          </Badge>
          <div className="flex items-center gap-1">
            {feature.trend.direction === 'up' && <TrendingUp className="h-3 w-3 text-green-500" />}
            {feature.trend.direction === 'down' && <TrendingDown className="h-3 w-3 text-red-500" />}
            {feature.trend.direction === 'stable' && <Minus className="h-3 w-3 text-muted-foreground" />}
            <span className="text-xs text-muted-foreground">
              {feature.trend.changePercent > 0 ? '+' : ''}{feature.trend.changePercent.toFixed(0)}% 7d
            </span>
          </div>
        </div>
        <span className={`text-sm font-mono font-bold ${sentimentColor}`}>
          {feature.sentiment.score > 0 ? '+' : ''}{(feature.sentiment.score * 100).toFixed(0)}% sentiment
        </span>
      </div>

      {/* Sentiment bar */}
      <div className="flex h-2 rounded-full overflow-hidden bg-muted">
        <div
          className="bg-green-500 transition-all"
          style={{ width: `${positivePercent}%` }}
        />
        <div
          className="bg-red-500 transition-all"
          style={{ width: `${negativePercent}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <ThumbsUp className="h-3 w-3 text-green-500" /> {feature.sentiment.positive} positive
        </span>
        <span className="flex items-center gap-1">
          <ThumbsDown className="h-3 w-3 text-red-500" /> {feature.sentiment.negative} negative
        </span>
      </div>

      {/* Top praises and complaints */}
      {(feature.topPraises.length > 0 || feature.topComplaints.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
          {feature.topPraises.length > 0 && (
            <div className="space-y-1">
              <span className="text-xs font-medium text-green-600 dark:text-green-400">Top Praise</span>
              {feature.topPraises.map((p, i) => (
                <p key={i} className="text-xs text-muted-foreground italic truncate">&ldquo;{p}&rdquo;</p>
              ))}
            </div>
          )}
          {feature.topComplaints.length > 0 && (
            <div className="space-y-1">
              <span className="text-xs font-medium text-red-600 dark:text-red-400">Top Complaint</span>
              {feature.topComplaints.map((c, i) => (
                <p key={i} className="text-xs text-muted-foreground italic truncate">&ldquo;{c}&rdquo;</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
