'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import {
  Trophy, TrendingUp, TrendingDown, Minus, BarChart3, RefreshCw,
  Globe, ArrowUpRight, ArrowDownRight, Sparkles
} from 'lucide-react'
import { PRODUCT_CATEGORIES, CATEGORY_ICONS, getCategoryName } from '@/lib/categories'
import type { ProductCategory } from '@/lib/categories'
import type { CategoryIntelligenceResult, CategoryProductEntry } from '@/lib/analytics/categoryIntelligence'

export default function CategoryIntelligencePage() {
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory>('TECH_SAAS')
  const [intelligence, setIntelligence] = useState<CategoryIntelligenceResult | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadIntelligence(selectedCategory)
  }, [selectedCategory])

  const loadIntelligence = async (category: ProductCategory) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/analytics/category-intelligence/${category}`)
      if (res.ok) {
        setIntelligence(await res.json())
      }
    } catch (err) {
      console.error('Failed to load intelligence:', err)
    } finally {
      setLoading(false)
    }
  }

  const ins = intelligence?.insights

  return (
    <div className="container mx-auto px-4 py-6 sm:p-6 space-y-6 max-w-full overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <Globe className="h-7 w-7 sm:h-8 sm:w-8 text-purple-500" />
            Category Intelligence
          </h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">
            Compare products within each category by health score, sentiment, and themes
          </p>
        </div>
      </div>

      {/* Category Tabs */}
      <Card>
        <CardContent className="pt-6">
          <Tabs value={selectedCategory} onValueChange={(v) => setSelectedCategory(v as ProductCategory)}>
            <TabsList className="flex h-auto overflow-x-auto overflow-y-hidden whitespace-nowrap pb-2 md:flex-wrap md:whitespace-normal">
              {Object.keys(PRODUCT_CATEGORIES).map((cat) => (
                <TabsTrigger key={cat} value={cat} className="flex items-center gap-2">
                  <span className="text-xl">{CATEGORY_ICONS[cat as ProductCategory]}</span>
                  {getCategoryName(cat as ProductCategory)}
                </TabsTrigger>
              ))}
            </TabsList>

            {Object.keys(PRODUCT_CATEGORIES).map((cat) => (
              <TabsContent key={cat} value={cat}>
                {loading && selectedCategory === cat ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <RefreshCw className="h-8 w-8 mx-auto animate-spin mb-2" />
                    Analyzing {getCategoryName(cat as ProductCategory)}...
                  </div>
                ) : intelligence && selectedCategory === cat ? (
                  <div className="space-y-6 mt-4">
                    {/* Insights Overview */}
                    {ins && (
                      <div className="grid gap-4 grid-cols-1 sm:grid-cols-4">
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium">Avg Health Score</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="text-3xl font-bold">{ins.avgHealthScore}</div>
                            <p className="text-xs text-muted-foreground mt-1">/100 across {ins.totalProducts} products</p>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium">Top Performer</CardTitle>
                            <Trophy className="h-4 w-4 text-yellow-500" />
                          </CardHeader>
                          <CardContent>
                            <div className="text-lg font-bold truncate">{ins.topPerformer?.name || '-'}</div>
                            <p className="text-xs text-muted-foreground mt-1">
                              Score: {ins.topPerformer?.score || 0}
                            </p>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium">Sentiment Split</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="flex gap-2 text-sm">
                              <span className="text-green-500">👍 {ins.sentimentDistribution.positive}</span>
                              <span className="text-red-500">👎 {ins.sentimentDistribution.negative}</span>
                              <span className="text-muted-foreground">😐 {ins.sentimentDistribution.neutral}</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">{ins.totalFeedback} total feedback</p>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium">Trending</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="flex gap-3 text-sm">
                              <span className="flex items-center gap-1 text-green-500">
                                <TrendingUp className="h-3 w-3" /> {ins.trendingUp} ↑
                              </span>
                              <span className="flex items-center gap-1 text-red-500">
                                <TrendingDown className="h-3 w-3" /> {ins.trendingDown} ↓
                              </span>
                            </div>
                            {ins.mostDiscussedTheme && (
                              <Badge variant="secondary" className="mt-2 text-xs">
                                🔥 {ins.mostDiscussedTheme}
                              </Badge>
                            )}
                          </CardContent>
                        </Card>
                      </div>
                    )}

                    {/* Product Rankings Table */}
                    {intelligence.products.length > 0 ? (
                      <Card>
                        <CardHeader>
                          <CardTitle>Products in {intelligence.categoryName}</CardTitle>
                          <CardDescription>Sorted by health score</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            {intelligence.products.map((product, idx) => (
                              <CategoryProductCard key={product.productId} product={product} rank={idx + 1} />
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    ) : (
                      <Card>
                        <CardContent className="text-center py-12 text-muted-foreground">
                          <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p className="text-lg font-medium">No products in this category yet</p>
                          <p className="text-sm mt-2">Products need a category assigned to appear here</p>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                ) : null}
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}

function CategoryProductCard({ product, rank }: { product: CategoryProductEntry; rank: number }) {
  const gradeColor = {
    A: 'text-green-500 bg-green-500/10',
    B: 'text-blue-500 bg-blue-500/10',
    C: 'text-yellow-500 bg-yellow-500/10',
    D: 'text-orange-500 bg-orange-500/10',
    F: 'text-red-500 bg-red-500/10',
  }[product.grade]

  return (
    <div className="flex items-center gap-4 border rounded-lg p-3 hover:shadow-sm transition-shadow">
      <div className="text-2xl font-bold text-muted-foreground min-w-[32px]">
        #{rank}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-semibold truncate">{product.productName}</h3>
            <div className="flex flex-wrap gap-1.5 mt-1">
              <Badge className={`text-xs ${gradeColor}`}>
                {product.healthScore} • Grade {product.grade}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {product.feedbackCount} data points
              </Badge>
              {product.topTheme && (
                <Badge variant="secondary" className="text-xs">
                  🏷️ {product.topTheme}
                </Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium ${product.avgSentiment >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {product.avgSentiment >= 0 ? '+' : ''}{(product.avgSentiment * 100).toFixed(0)}%
            </span>
            {product.trend === 'improving' && <TrendingUp className="h-4 w-4 text-green-500" />}
            {product.trend === 'declining' && <TrendingDown className="h-4 w-4 text-red-500" />}
            {product.trend === 'stable' && <Minus className="h-4 w-4 text-muted-foreground" />}
          </div>
        </div>
      </div>
    </div>
  )
}
