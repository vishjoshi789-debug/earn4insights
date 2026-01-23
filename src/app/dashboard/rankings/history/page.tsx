'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Calendar, Trophy, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { PRODUCT_CATEGORIES, getCategoryName } from '@/lib/categories'
import type { ProductCategory } from '@/lib/categories'
import type { WeeklyRanking } from '@/lib/types/ranking'
import Link from 'next/link'

export default function RankingHistoryPage() {
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory>('TECH_SAAS')
  const [history, setHistory] = useState<WeeklyRanking[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadHistory()
  }, [selectedCategory])

  const loadHistory = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/rankings/${selectedCategory}/history`)
      if (response.ok) {
        const data = await response.json()
        setHistory(data)
      }
    } catch (error) {
      console.error('Failed to load history:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Calendar className="h-8 w-8" />
          Ranking History
        </h1>
        <p className="text-muted-foreground mt-1">
          View historical rankings and track product performance over time
        </p>
      </div>

      {/* Category Selector */}
      <Card>
        <CardHeader>
          <CardTitle>Select Category</CardTitle>
          <CardDescription>Choose a category to view its ranking history</CardDescription>
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
                    <span>{PRODUCT_CATEGORIES[category as ProductCategory].icon}</span>
                    {getCategoryName(category as ProductCategory)}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* History Timeline */}
      {loading ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            Loading history...
          </CardContent>
        </Card>
      ) : history.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Trophy className="h-12 w-12 mx-auto mb-4 opacity-50 text-muted-foreground" />
            <p className="text-lg font-medium">No ranking history yet</p>
            <p className="text-sm text-muted-foreground mt-2">
              Rankings will appear here once they are generated for {getCategoryName(selectedCategory)}
            </p>
            <Button className="mt-4" asChild>
              <Link href="/dashboard/rankings">Go to Rankings Dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {history.map((ranking, index) => (
            <WeeklyRankingCard 
              key={`${ranking.year}-${ranking.weekNumber}`} 
              ranking={ranking}
              isLatest={index === 0}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function WeeklyRankingCard({ ranking, isLatest }: { ranking: WeeklyRanking; isLatest: boolean }) {
  const [expanded, setExpanded] = useState(isLatest)

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="flex items-center gap-2">
              Week {ranking.weekNumber}, {ranking.year}
              {isLatest && <Badge>Latest</Badge>}
            </CardTitle>
            <CardDescription>
              {new Date(ranking.weekStart).toLocaleDateString()} - {new Date(ranking.weekEnd).toLocaleDateString()}
            </CardDescription>
          </div>
          <div className="text-right">
            <div className="text-sm text-muted-foreground">Products Ranked</div>
            <div className="text-2xl font-bold">{ranking.products.length}</div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Button 
          variant="outline" 
          className="w-full mb-4"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? 'Hide' : 'Show'} Rankings
        </Button>

        {expanded && (
          <div className="space-y-3">
            {ranking.products.map((product, index) => {
              const rank = index + 1
              const rankChange = product.previousRank ? product.previousRank - rank : null

              return (
                <div key={product.productId} className="flex items-center gap-4 p-3 border rounded-lg">
                  <div className="text-2xl font-bold text-muted-foreground min-w-[50px]">
                    #{rank}
                  </div>

                  <div className="flex-1">
                    <div className="font-semibold">{product.productName}</div>
                    <div className="flex flex-wrap gap-2 mt-1">
                      <Badge variant="outline">Score: {product.rankingScore.toFixed(2)}</Badge>
                      {product.metrics.npsScore !== null && (
                        <Badge variant="outline">NPS: {product.metrics.npsScore.toFixed(1)}</Badge>
                      )}
                      <Badge variant="outline">{product.metrics.totalResponses} responses</Badge>
                    </div>
                  </div>

                  {rankChange !== null && (
                    <div className="text-right min-w-[80px]">
                      <div className="text-xs text-muted-foreground">Change</div>
                      <div className={`flex items-center gap-1 font-bold ${
                        rankChange > 0 ? 'text-green-600' : 
                        rankChange < 0 ? 'text-red-600' : 
                        'text-gray-600'
                      }`}>
                        {rankChange > 0 && <TrendingUp className="h-4 w-4" />}
                        {rankChange < 0 && <TrendingDown className="h-4 w-4" />}
                        {rankChange === 0 && <Minus className="h-4 w-4" />}
                        {Math.abs(rankChange)}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <div className="mt-4 pt-4 border-t text-sm text-muted-foreground">
          Generated on {new Date(ranking.generatedAt).toLocaleString()}
        </div>
      </CardContent>
    </Card>
  )
}
