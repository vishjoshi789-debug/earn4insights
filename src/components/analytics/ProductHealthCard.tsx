'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { TrendingUp, TrendingDown, Minus, Heart, AlertTriangle, Sparkles, Star, MessageSquare } from 'lucide-react'

type HealthData = {
  healthScore: number
  grade: string
  trend: string
  breakdown: Record<string, { score: number; weight: number; weighted: number; detail: string }>
  dataPoints: number
  lastFeedbackAt: string | null
}

type SummaryData = {
  topPraise: { label: string; theme: string; mentionCount: number; example: string | null } | null
  topConcern: { label: string; theme: string; mentionCount: number; example: string | null } | null
  emergingIssue: { label: string; theme: string; mentionCount: number; example: string | null } | null
  overallSentiment: { positive: number; negative: number; neutral: number; score: number }
  recentHighlights: string[]
  totalFeedbackCount: number
}

export function ProductHealthCard({ productId }: { productId: string }) {
  const [health, setHealth] = useState<HealthData | null>(null)
  const [summary, setSummary] = useState<SummaryData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const [hRes, sRes] = await Promise.all([
          fetch(`/api/analytics/health-score/${productId}`),
          fetch(`/api/analytics/public-summary/${productId}`),
        ])
        if (hRes.ok) setHealth(await hRes.json())
        if (sRes.ok) setSummary(await sRes.json())
      } catch (err) {
        console.error('Failed to load product health:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [productId])

  if (loading) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-muted-foreground text-sm">
          Loading health score...
        </CardContent>
      </Card>
    )
  }

  if (!health || health.dataPoints === 0) {
    return null // Don't show if no data
  }

  const gradeColors: Record<string, string> = {
    A: 'text-green-500 border-green-500',
    B: 'text-blue-500 border-blue-500',
    C: 'text-yellow-500 border-yellow-500',
    D: 'text-orange-500 border-orange-500',
    F: 'text-red-500 border-red-500',
  }

  const trendIcon = health.trend === 'improving'
    ? <TrendingUp className="h-4 w-4 text-green-500" />
    : health.trend === 'declining'
    ? <TrendingDown className="h-4 w-4 text-red-500" />
    : <Minus className="h-4 w-4 text-muted-foreground" />

  return (
    <div className="space-y-4">
      {/* Health Score Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Heart className="h-5 w-5 text-purple-500" />
            Product Health Score
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6 mb-4">
            <div className={`text-5xl font-bold ${gradeColors[health.grade] || 'text-muted-foreground'}`}>
              {health.healthScore}
            </div>
            <div>
              <div className={`text-2xl font-bold border-2 rounded-lg px-3 py-1 inline-block ${gradeColors[health.grade] || ''}`}>
                {health.grade}
              </div>
              <div className="flex items-center gap-1 mt-1 text-sm text-muted-foreground">
                {trendIcon} <span className="capitalize">{health.trend}</span>
              </div>
            </div>
            <div className="text-sm text-muted-foreground ml-auto text-right">
              <div>{health.dataPoints} data points</div>
              {health.lastFeedbackAt && (
                <div>Last: {new Date(health.lastFeedbackAt).toLocaleDateString()}</div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            {Object.entries(health.breakdown).map(([key, val]) => (
              <div key={key} className="flex items-center gap-2 text-sm">
                <span className="w-24 text-muted-foreground capitalize">{key}</span>
                <Progress value={val.score * 100} className="flex-1 h-2" />
                <span className="w-12 text-right font-mono text-xs">{(val.score * 100).toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* AI Summary Card */}
      {summary && summary.totalFeedbackCount > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="h-5 w-5 text-purple-500" />
              AI Feedback Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Sentiment Overview */}
            <div className="flex gap-4 text-sm">
              <span className="text-green-600">👍 {summary.overallSentiment.positive} positive</span>
              <span className="text-red-600">👎 {summary.overallSentiment.negative} negative</span>
              <span className="text-muted-foreground">😐 {summary.overallSentiment.neutral} neutral</span>
            </div>

            {/* Key Insights */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {summary.topPraise && (
                <InsightCard
                  icon={<Star className="h-4 w-4 text-green-500" />}
                  label={summary.topPraise.label}
                  theme={summary.topPraise.theme}
                  count={summary.topPraise.mentionCount}
                  example={summary.topPraise.example}
                  colorClass="border-green-500/30 bg-green-50 dark:bg-green-950/20"
                />
              )}
              {summary.topConcern && (
                <InsightCard
                  icon={<AlertTriangle className="h-4 w-4 text-red-500" />}
                  label={summary.topConcern.label}
                  theme={summary.topConcern.theme}
                  count={summary.topConcern.mentionCount}
                  example={summary.topConcern.example}
                  colorClass="border-red-500/30 bg-red-50 dark:bg-red-950/20"
                />
              )}
              {summary.emergingIssue && (
                <InsightCard
                  icon={<MessageSquare className="h-4 w-4 text-yellow-500" />}
                  label={summary.emergingIssue.label}
                  theme={summary.emergingIssue.theme}
                  count={summary.emergingIssue.mentionCount}
                  example={summary.emergingIssue.example}
                  colorClass="border-yellow-500/30 bg-yellow-50 dark:bg-yellow-950/20"
                />
              )}
            </div>

            {/* Recent Highlights */}
            {summary.recentHighlights.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Recent positive feedback</p>
                <div className="space-y-1">
                  {summary.recentHighlights.map((h, i) => (
                    <p key={i} className="text-xs italic text-muted-foreground">&ldquo;{h}&rdquo;</p>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function InsightCard({
  icon,
  label,
  theme,
  count,
  example,
  colorClass,
}: {
  icon: React.ReactNode
  label: string
  theme: string
  count: number
  example: string | null
  colorClass: string
}) {
  return (
    <div className={`rounded-lg border p-3 ${colorClass}`}>
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <div className="font-semibold text-sm">{theme}</div>
      <div className="text-xs text-muted-foreground">{count} mentions</div>
      {example && (
        <p className="text-xs italic text-muted-foreground mt-1 line-clamp-2">&ldquo;{example}&rdquo;</p>
      )}
    </div>
  )
}
