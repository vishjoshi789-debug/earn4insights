'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { TrendingUp, TrendingDown, Trophy, BarChart3 } from 'lucide-react'
import { PRODUCT_CATEGORIES, CATEGORY_ICONS, getCategoryName } from '@/lib/categories'
import type { ProductCategory } from '@/lib/categories'

type RankingHistoryData = {
  weekStart: string
  rank: number | null
  score: number
  weekId: string
}

type ProductTrend = {
  productId: string
  productName: string
  history: RankingHistoryData[]
}

export default function AnalyticsPage() {
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory>('TECH_SAAS')
  const [trends, setTrends] = useState<ProductTrend[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadTrends()
  }, [selectedCategory])

  const loadTrends = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/rankings/${selectedCategory}/trends`)
      if (response.ok) {
        const data = await response.json()
        setTrends(data)
      }
    } catch (error) {
      console.error('Failed to load trends:', error)
    } finally {
      setLoading(false)
    }
  }

  // Prepare data for charts
  const prepareChartData = () => {
    if (trends.length === 0) return []

    // Get all unique weeks
    const allWeeks = new Set<string>()
    trends.forEach(t => t.history.forEach(h => allWeeks.add(h.weekId)))
    const sortedWeeks = Array.from(allWeeks).sort()

    // Create data points for each week
    return sortedWeeks.map(weekId => {
      const dataPoint: any = { week: weekId }
      trends.forEach(trend => {
        const weekData = trend.history.find(h => h.weekId === weekId)
        dataPoint[trend.productName] = weekData?.rank || null
      })
      return dataPoint
    })
  }

  const prepareScoreChartData = () => {
    if (trends.length === 0) return []

    const allWeeks = new Set<string>()
    trends.forEach(t => t.history.forEach(h => allWeeks.add(h.weekId)))
    const sortedWeeks = Array.from(allWeeks).sort()

    return sortedWeeks.map(weekId => {
      const dataPoint: any = { week: weekId }
      trends.forEach(trend => {
        const weekData = trend.history.find(h => h.weekId === weekId)
        dataPoint[trend.productName] = weekData?.score || 0
      })
      return dataPoint
    })
  }

  const chartData = prepareChartData()
  const scoreChartData = prepareScoreChartData()

  // Calculate insights
  const insights = trends.map(trend => {
    const recentHistory = trend.history.slice(-4)
    const oldestRank = recentHistory[0]?.rank
    const latestRank = recentHistory[recentHistory.length - 1]?.rank

    const improvement = oldestRank && latestRank ? oldestRank - latestRank : 0
    const avgScore = trend.history.reduce((sum, h) => sum + h.score, 0) / trend.history.length

    return {
      ...trend,
      improvement,
      avgScore,
      latestRank,
    }
  }).filter(i => i.latestRank !== null)

  const topImprovers = [...insights].sort((a, b) => b.improvement - a.improvement).slice(0, 5)
  const topPerformers = [...insights].sort((a, b) => (a.latestRank || 11) - (b.latestRank || 11)).slice(0, 5)

  const colors = ['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#a78bfa', '#f472b6', '#fb923c']

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <BarChart3 className="h-8 w-8 text-blue-500" />
          Ranking Analytics
        </h1>
        <p className="text-muted-foreground mt-1">
          Track ranking trends and performance over time
        </p>
      </div>

      {/* Category Selector */}
      <Card>
        <CardHeader>
          <CardTitle>Select Category</CardTitle>
          <CardDescription>Choose a category to view analytics</CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={selectedCategory} onValueChange={(value) => setSelectedCategory(value as ProductCategory)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.keys(PRODUCT_CATEGORIES).map((category) => (
                <SelectItem key={category} value={category}>
                  <div className="flex items-center gap-2">
                    <span>{CATEGORY_ICONS[category as ProductCategory]}</span>
                    {getCategoryName(category as ProductCategory)}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {loading ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            Loading analytics...
          </CardContent>
        </Card>
      ) : trends.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">No ranking data yet</p>
            <p className="text-sm mt-2">
              Analytics will appear once rankings have been generated for {getCategoryName(selectedCategory)}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Insights Cards */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Top Improvers */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                  Top Improvers
                </CardTitle>
                <CardDescription>Products with biggest rank improvements</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {topImprovers.map((product, index) => (
                    <div key={product.productId} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xl font-bold text-muted-foreground">#{index + 1}</span>
                        <span className="font-medium">{product.productName}</span>
                      </div>
                      <Badge variant={product.improvement > 0 ? 'default' : 'secondary'} className="bg-green-500">
                        <TrendingUp className="h-3 w-3 mr-1" />
                        +{product.improvement}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Top Performers */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-yellow-500" />
                  Top Performers
                </CardTitle>
                <CardDescription>Highest ranked products currently</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {topPerformers.map((product) => (
                    <div key={product.productId} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xl font-bold text-muted-foreground">
                          #{product.latestRank}
                        </span>
                        <span className="font-medium">{product.productName}</span>
                      </div>
                      <Badge variant="outline">
                        Score: {product.avgScore.toFixed(2)}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Rank Trend Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Ranking Trends</CardTitle>
              <CardDescription>
                Track how product rankings change over time (lower is better)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="week" />
                    <YAxis reversed domain={[1, 10]} />
                    <Tooltip />
                    <Legend />
                    {trends.slice(0, 7).map((trend, index) => (
                      <Line
                        key={trend.productId}
                        type="monotone"
                        dataKey={trend.productName}
                        stroke={colors[index % colors.length]}
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        connectNulls
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Score Trend Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Score Trends</CardTitle>
              <CardDescription>
                Compare ranking scores over time (higher is better)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={scoreChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="week" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    {trends.slice(0, 7).map((trend, index) => (
                      <Bar
                        key={trend.productId}
                        dataKey={trend.productName}
                        fill={colors[index % colors.length]}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
