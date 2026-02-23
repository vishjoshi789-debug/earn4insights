'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Trophy, TrendingUp, Calendar, Sparkles, RefreshCw, ExternalLink } from 'lucide-react'
import { PRODUCT_CATEGORIES, CATEGORY_ICONS, getCategoryName } from '@/lib/categories'
import type { ProductCategory } from '@/lib/categories'
import type { WeeklyRanking, RankedProduct } from '@/lib/types/ranking'
import Link from 'next/link'

export default function RankingsPage() {
  const [rankings, setRankings] = useState<Record<string, WeeklyRanking>>({})
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory>('TECH_SAAS')
  const [productStats, setProductStats] = useState<any>(null)

  useEffect(() => {
    loadCurrentRankings()
    checkProductStatus()
  }, [])

  const loadCurrentRankings = async () => {
    setLoading(true)
    try {
      // Load rankings for all categories
      const rankingData: Record<string, WeeklyRanking> = {}
      
      for (const category of Object.keys(PRODUCT_CATEGORIES) as ProductCategory[]) {
        try {
          const response = await fetch(`/api/rankings/${category}`)
          if (response.ok) {
            const data = await response.json()
            rankingData[category] = data
          }
        } catch (error) {
          console.error(`Failed to load rankings for ${category}:`, error)
        }
      }
      
      setRankings(rankingData)
    } catch (error) {
      console.error('Failed to load rankings:', error)
    } finally {
      setLoading(false)
    }
  }

  const checkProductStatus = async () => {
    try {
      const response = await fetch('/api/admin/check-products')
      if (response.ok) {
        const data = await response.json()
        setProductStats(data)
      }
    } catch (error) {
      console.error('Failed to check product status:', error)
    }
  }

  const generateRankings = async () => {
    setGenerating(true)
    try {
      const response = await fetch('/api/admin/generate-rankings?apiKey=test123', {
        method: 'POST',
      })
      
      if (response.ok) {
        const result = await response.json()
        alert(`Successfully generated rankings for ${result.categoriesProcessed} categories!`)
        await loadCurrentRankings()
      } else {
        const error = await response.json()
        alert(`Failed to generate rankings: ${error.error}`)
      }
    } catch (error) {
      console.error('Failed to generate rankings:', error)
      alert('Failed to generate rankings. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  const currentRanking = rankings[selectedCategory]
  const totalRankings = Object.keys(rankings).length
  const totalProducts = Object.values(rankings).reduce((sum, r) => sum + r.products.length, 0)

  return (
    <div className="container mx-auto px-4 py-6 sm:p-6 space-y-6 max-w-full overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <Trophy className="h-7 w-7 sm:h-8 sm:w-8 text-yellow-500" />
            Weekly Rankings
          </h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">
            Manage and view your weekly rankings
          </p>
        </div>
        <Button 
          onClick={generateRankings} 
          disabled={generating}
          className="gap-2 w-full sm:w-auto"
        >
          <RefreshCw className={`h-4 w-4 ${generating ? 'animate-spin' : ''}`} />
          {generating ? 'Generating...' : 'Generate Rankings'}
        </Button>
      </div>

      {/* Setup Alert */}
      {productStats && productStats.productsWithoutCategories > 0 && (
        <Card className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-900 dark:text-yellow-100">
              <Sparkles className="h-5 w-5" />
              Setup Required
            </CardTitle>
          </CardHeader>
          <CardContent className="text-yellow-900 dark:text-yellow-100">
            <p className="mb-2">
              <strong>{productStats.productsWithoutCategories}</strong> of <strong>{productStats.totalProducts}</strong> products need categories assigned.
            </p>
            <p className="mb-2">
              Total survey responses: <strong>{productStats.totalResponses}</strong>
            </p>
            <p className="text-sm mb-4">
              Products need categories and at least 20 responses to appear in rankings.
            </p>
            <div className="space-y-1 text-sm">
              {productStats.productStats
                .filter((p: any, index: number, self: any[]) => 
                  self.findIndex((t: any) => t.id === p.id) === index
                )
                .map((p: any) => (
                  <div key={p.id} className="flex flex-col sm:flex-row sm:justify-between gap-0.5">
                    <span className="truncate">{p.name}</span>
                    <span className={`text-xs sm:text-sm ${p.hasCategory ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {p.category} • {p.responseCount} responses
                    </span>
                  </div>
                ))}
            </div>
            <Button variant="outline" className="mt-4" asChild>
              <Link href="/dashboard/rankings/categories">
                Assign Categories to Products
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Overview Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Categories Ranked</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalRankings}</div>
            <p className="text-xs text-muted-foreground">
              of {Object.keys(PRODUCT_CATEGORIES).length} total categories
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ranked Products</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalProducts}</div>
            <p className="text-xs text-muted-foreground">
              products in current week
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Week</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {currentRanking ? new Date(currentRanking.weekStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '-'}
            </div>
            <p className="text-xs text-muted-foreground">
              {currentRanking ? new Date(currentRanking.weekStart).toLocaleDateString() : 'No rankings yet'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Category Tabs */}
      <Card>
        <CardHeader>
          <CardTitle>Rankings by Category</CardTitle>
          <CardDescription>
            View current week's top products in each category
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={selectedCategory} onValueChange={(value) => setSelectedCategory(value as ProductCategory)}>
            <TabsList className="flex h-auto overflow-x-auto overflow-y-hidden whitespace-nowrap pb-2 md:flex-wrap md:whitespace-normal">
              {Object.keys(PRODUCT_CATEGORIES).map((category) => (
                <TabsTrigger key={category} value={category} className="flex items-center gap-2">
                  <span className="text-xl">{CATEGORY_ICONS[category as ProductCategory]}</span>
                  {getCategoryName(category as ProductCategory)}
                </TabsTrigger>
              ))}
            </TabsList>

            {Object.keys(PRODUCT_CATEGORIES).map((category) => (
              <TabsContent key={category} value={category} className="mt-4">
                <CategoryRankingView 
                  ranking={rankings[category as ProductCategory]} 
                  category={category as ProductCategory}
                  loading={loading}
                />
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      {/* Quick Links */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button variant="outline" className="w-full justify-start gap-2" asChild>
            <Link href="/top-products">
              <ExternalLink className="h-4 w-4" />
              View Public Rankings Page
            </Link>
          </Button>
          <Button variant="outline" className="w-full justify-start gap-2" asChild>
            <Link href="/dashboard/rankings/history">
              <Calendar className="h-4 w-4" />
              View Ranking History
            </Link>
          </Button>
          <Button variant="outline" className="w-full justify-start gap-2" asChild>
            <Link href="/dashboard/rankings/analytics">
              <TrendingUp className="h-4 w-4" />
              View Analytics & Trends
            </Link>
          </Button>
          <Button variant="outline" className="w-full justify-start gap-2" asChild>
            <Link href="/dashboard/rankings/categories">
              <Sparkles className="h-4 w-4" />
              Manage Product Categories
            </Link>
          </Button>
          <Button variant="outline" className="w-full justify-start gap-2 border-dashed" asChild>
            <Link href="/dashboard/rankings/test-email">
              <span className="h-4 w-4">📧</span>
              Test Email Notifications
            </Link>
          </Button>
          <Button variant="outline" className="w-full justify-start gap-2 border-dashed" asChild>
            <Link href="/dashboard/rankings/test-whatsapp">
              <span className="h-4 w-4">📱</span>
              Test WhatsApp Notifications
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

function CategoryRankingView({ 
  ranking, 
  category,
  loading 
}: { 
  ranking?: WeeklyRanking
  category: ProductCategory
  loading: boolean
}) {
  if (loading) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Loading rankings...
      </div>
    )
  }

  if (!ranking || ranking.products.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Trophy className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p className="text-lg font-medium">No rankings yet for {getCategoryName(category)}</p>
        <p className="text-sm mt-2">Generate rankings or wait for products to accumulate enough data.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-4">
        <div>
          <p className="text-sm text-muted-foreground">
            {new Date(ranking.weekStart).toLocaleDateString()} - {new Date(ranking.weekEnd).toLocaleDateString()}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Generated on {new Date(ranking.generatedAt).toLocaleString()}
          </p>
        </div>
        <Button variant="outline" size="sm" className="w-full sm:w-auto" asChild>
          <Link href={`/top-products/${category.toLowerCase()}`}>
            View Public Page
          </Link>
        </Button>
      </div>

      <div className="space-y-3">
        {ranking.products.map((product, index) => (
          <ProductRankCard key={product.productId} product={product} rank={index + 1} />
        ))}
      </div>
    </div>
  )
}

function ProductRankCard({ product, rank }: { product: RankedProduct; rank: number }) {
  const getMedalColor = (rank: number) => {
    if (rank === 1) return 'text-yellow-500'
    if (rank === 2) return 'text-gray-400'
    if (rank === 3) return 'text-orange-600'
    return 'text-muted-foreground'
  }

  const getBadgeVariant = (rank: number): "default" | "secondary" | "outline" => {
    if (rank <= 3) return 'default'
    if (rank <= 5) return 'secondary'
    return 'outline'
  }

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-start gap-3 sm:gap-4">
          <div className={`text-2xl sm:text-3xl font-bold ${getMedalColor(rank)} min-w-[32px] sm:min-w-[40px]`}>
            #{rank}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4">
              <div className="min-w-0">
                <h3 className="font-semibold text-base sm:text-lg truncate">{product.productName}</h3>
                <div className="flex flex-wrap gap-1.5 sm:gap-2 mt-2">
                  <Badge variant={getBadgeVariant(rank)} className="text-xs">
                    Score: {product.rankingScore.toFixed(2)}
                  </Badge>
                  {product.metrics.npsScore !== null && (
                    <Badge variant="outline" className="text-xs">
                      NPS: {product.metrics.npsScore.toFixed(1)}
                    </Badge>
                  )}
                  {product.metrics.sentimentScore !== null && (
                    <Badge variant="outline" className="text-xs">
                      Sentiment: {(product.metrics.sentimentScore * 100).toFixed(0)}%
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-xs">
                    {product.metrics.totalResponses} responses
                  </Badge>
                </div>
              </div>
              
              {product.previousRank && (
                <div className="text-left sm:text-right">
                  <div className="text-sm text-muted-foreground">Previous Rank</div>
                  <div className={`text-lg font-bold ${
                    product.previousRank > rank ? 'text-green-600' : 
                    product.previousRank < rank ? 'text-red-600' : 
                    'text-gray-600'
                  }`}>
                    #{product.previousRank}
                    {product.previousRank > rank && ' ↑'}
                    {product.previousRank < rank && ' ↓'}
                  </div>
                </div>
              )}
            </div>

            {/* Metrics Breakdown */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 text-sm">
              <div>
                <div className="text-muted-foreground">Completion</div>
                <div className="font-medium">{(product.metrics.surveyCompletionRate * 100).toFixed(1)}%</div>
              </div>
              <div>
                <div className="text-muted-foreground">Trend</div>
                <div className="font-medium">{product.metrics.weekOverWeekChange > 0 ? '+' : ''}{product.metrics.weekOverWeekChange.toFixed(1)}%</div>
              </div>
              <div>
                <div className="text-muted-foreground">Sentiment</div>
                <div className="font-medium">{(product.metrics.sentimentScore * 100).toFixed(0)}%</div>
              </div>
              <div>
                <div className="text-muted-foreground">Responses</div>
                <div className="font-medium">{product.metrics.totalResponses}</div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
