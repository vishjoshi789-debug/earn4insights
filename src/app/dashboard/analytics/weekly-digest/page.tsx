'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  AlertTriangle, TrendingUp, TrendingDown, Minus, Bell, 
  BarChart3, RefreshCw, ArrowUpRight, ArrowDownRight, 
  MessageSquare, Flame, AlertCircle, Volume2 
} from 'lucide-react'
import type { WeeklyDigestResult, DigestAlert, DigestProductSummary } from '@/lib/analytics/weeklyDigest'

export default function WeeklyDigestPage() {
  const [digest, setDigest] = useState<WeeklyDigestResult | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDigest()
  }, [])

  const loadDigest = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/analytics/weekly-digest')
      if (res.ok) {
        setDigest(await res.json())
      }
    } catch (err) {
      console.error('Failed to load digest:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-6 space-y-6">
        <div className="text-center py-12 text-muted-foreground">
          <RefreshCw className="h-8 w-8 mx-auto animate-spin mb-2" />
          Generating your weekly digest...
        </div>
      </div>
    )
  }

  if (!digest) {
    return (
      <div className="container mx-auto px-4 py-6 space-y-6">
        <div className="text-center py-12 text-muted-foreground">
          <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Unable to generate digest. Make sure you have products with feedback.</p>
        </div>
      </div>
    )
  }

  const stats = digest.overallStats

  return (
    <div className="container mx-auto px-4 py-6 sm:p-6 space-y-6 max-w-full overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <Bell className="h-7 w-7 sm:h-8 sm:w-8 text-purple-500" />
            Weekly Digest
          </h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">
            {new Date(digest.weekStart).toLocaleDateString()} — {new Date(digest.weekEnd).toLocaleDateString()}
          </p>
        </div>
        <Button variant="outline" onClick={loadDigest} disabled={loading} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Feedback This Week</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.totalFeedbackThisWeek}</div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
              {stats.volumeChange > 0 ? (
                <ArrowUpRight className="h-3 w-3 text-green-500" />
              ) : stats.volumeChange < 0 ? (
                <ArrowDownRight className="h-3 w-3 text-red-500" />
              ) : (
                <Minus className="h-3 w-3" />
              )}
              {stats.volumeChange > 0 ? '+' : ''}{stats.volumeChange.toFixed(0)}% vs last week
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Avg Sentiment</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${stats.avgSentimentThisWeek >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {stats.avgSentimentThisWeek >= 0 ? '+' : ''}{(stats.avgSentimentThisWeek * 100).toFixed(0)}%
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
              {stats.sentimentChange > 0 ? (
                <TrendingUp className="h-3 w-3 text-green-500" />
              ) : stats.sentimentChange < 0 ? (
                <TrendingDown className="h-3 w-3 text-red-500" />
              ) : (
                <Minus className="h-3 w-3" />
              )}
              {stats.sentimentChange > 0 ? '+' : ''}{(stats.sentimentChange * 100).toFixed(0)}% change
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Products</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{digest.productSummaries.length}</div>
            <p className="text-xs text-muted-foreground mt-1">products with feedback</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">New Themes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.newThemesCount}</div>
            <p className="text-xs text-muted-foreground mt-1">themes extracted this week</p>
          </CardContent>
        </Card>
      </div>

      {/* Alerts */}
      {digest.alerts.length > 0 && (
        <Card className="border-yellow-500/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Alerts ({digest.alerts.length})
            </CardTitle>
            <CardDescription>Issues that need your attention this week</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {digest.alerts.map((alert, i) => (
              <AlertCard key={i} alert={alert} />
            ))}
          </CardContent>
        </Card>
      )}

      {digest.alerts.length === 0 && (
        <Card className="border-green-500/50">
          <CardContent className="py-6 text-center">
            <p className="text-green-600 dark:text-green-400 font-medium">
              ✅ No critical alerts this week — your products are looking healthy!
            </p>
          </CardContent>
        </Card>
      )}

      {/* Product Summaries */}
      {digest.productSummaries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Product Summary</CardTitle>
            <CardDescription>Weekly performance for each of your products</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {digest.productSummaries.map((product) => (
              <ProductSummaryCard key={product.productId} product={product} />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function AlertCard({ alert }: { alert: DigestAlert }) {
  const getIcon = () => {
    switch (alert.type) {
      case 'sentiment_drop': return <TrendingDown className="h-4 w-4 text-red-500" />
      case 'volume_spike': return <Volume2 className="h-4 w-4 text-blue-500" />
      case 'recurring_issue': return <Flame className="h-4 w-4 text-orange-500" />
      case 'emerging_theme': return <AlertCircle className="h-4 w-4 text-yellow-500" />
    }
  }

  const severityColor = {
    high: 'border-red-500/50 bg-red-50 dark:bg-red-950/20',
    medium: 'border-yellow-500/50 bg-yellow-50 dark:bg-yellow-950/20',
    low: 'border-blue-500/50 bg-blue-50 dark:bg-blue-950/20',
  }

  return (
    <div className={`rounded-lg border p-3 ${severityColor[alert.severity]}`}>
      <div className="flex items-start gap-2">
        {getIcon()}
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">{alert.title}</span>
            <Badge
              variant={alert.severity === 'high' ? 'destructive' : 'outline'}
              className="text-xs"
            >
              {alert.severity}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">{alert.description}</p>
        </div>
      </div>
    </div>
  )
}

function ProductSummaryCard({ product }: { product: DigestProductSummary }) {
  return (
    <div className="border rounded-lg p-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
        <h3 className="font-semibold">{product.productName}</h3>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {product.feedbackThisWeek} feedback
          </Badge>
          {product.volumeChange !== 0 && (
            <span className={`text-xs flex items-center gap-0.5 ${product.volumeChange > 0 ? 'text-green-600' : 'text-red-600'}`}>
              {product.volumeChange > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {product.volumeChange > 0 ? '+' : ''}{product.volumeChange.toFixed(0)}%
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        <div>
          <div className="text-muted-foreground text-xs">Sentiment</div>
          <div className={`font-medium ${product.sentimentThisWeek >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {product.sentimentThisWeek >= 0 ? '+' : ''}{(product.sentimentThisWeek * 100).toFixed(0)}%
          </div>
        </div>
        <div>
          <div className="text-muted-foreground text-xs">Sentiment Δ</div>
          <div className={`font-medium flex items-center gap-1 ${product.sentimentChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {product.sentimentChange > 0 ? <TrendingUp className="h-3 w-3" /> : product.sentimentChange < 0 ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
            {product.sentimentChange >= 0 ? '+' : ''}{(product.sentimentChange * 100).toFixed(0)}%
          </div>
        </div>
        <div>
          <div className="text-muted-foreground text-xs">This Week</div>
          <div className="font-medium">{product.feedbackThisWeek}</div>
        </div>
        <div>
          <div className="text-muted-foreground text-xs">Last Week</div>
          <div className="font-medium">{product.feedbackLastWeek}</div>
        </div>
      </div>

      {product.topThemes.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-3">
          {product.topThemes.map((theme) => (
            <Badge key={theme} variant="secondary" className="text-xs">{theme}</Badge>
          ))}
        </div>
      )}
    </div>
  )
}
