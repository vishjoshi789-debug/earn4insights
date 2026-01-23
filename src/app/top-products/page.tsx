import Link from 'next/link'
import { getAllCurrentRankings } from '@/server/rankings/rankingStore'
import { CATEGORY_ICONS, getCategoryName, CATEGORY_KEYS } from '@/lib/categories'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { TrendingUp, TrendingDown, Minus, Trophy, Star, Users } from 'lucide-react'

export const metadata = {
  title: 'Top Products of the Week | Earn4Insights',
  description: 'Discover the top-rated products based on real user feedback, NPS scores, and sentiment analysis.',
}

export default async function TopProductsPage() {
  const rankings = await getAllCurrentRankings()

  // Get categories with rankings
  const categoriesWithRankings = new Set(rankings.map(r => r.category))

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        <div className="container mx-auto px-4 py-16">
          <div className="flex items-center justify-center mb-6">
            <Trophy className="h-16 w-16 text-yellow-300" />
          </div>
          <h1 className="text-5xl font-bold text-center mb-4">
            Top Products of the Week
          </h1>
          <p className="text-xl text-center text-blue-100 max-w-2xl mx-auto">
            Ranked by real user feedback, NPS scores, sentiment analysis, and engagement metrics
          </p>
          
          {rankings.length > 0 && (
            <div className="mt-8 flex justify-center gap-8 text-center">
              <div>
                <div className="text-3xl font-bold">{rankings.reduce((sum, r) => sum + r.rankings.length, 0)}</div>
                <div className="text-blue-200">Top Products</div>
              </div>
              <div>
                <div className="text-3xl font-bold">{categoriesWithRankings.size}</div>
                <div className="text-blue-200">Categories</div>
              </div>
              <div>
                <div className="text-3xl font-bold">
                  {rankings.reduce((sum, r) => sum + r.totalProductsEvaluated, 0)}
                </div>
                <div className="text-blue-200">Products Evaluated</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Category Grid */}
      <div className="container mx-auto px-4 py-12">
        {rankings.length === 0 ? (
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle>No Rankings Yet</CardTitle>
              <CardDescription>
                Weekly rankings haven&apos;t been generated yet. Check back soon!
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {CATEGORY_KEYS.map(categoryKey => {
              const ranking = rankings.find(r => r.category === categoryKey)
              const hasRanking = ranking && ranking.rankings.length > 0

              return (
                <Link
                  key={categoryKey}
                  href={hasRanking ? `/top-products/${categoryKey}` : '#'}
                  className={hasRanking ? 'group' : 'cursor-not-allowed opacity-50'}
                >
                  <Card className={`h-full transition-all ${hasRanking ? 'hover:shadow-xl hover:scale-105' : ''}`}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="text-4xl mb-2">{CATEGORY_ICONS[categoryKey]}</div>
                        {hasRanking && (
                          <Badge variant="secondary">
                            {ranking.rankings.length} Products
                          </Badge>
                        )}
                      </div>
                      <CardTitle className="text-xl">{getCategoryName(categoryKey)}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {hasRanking ? (
                        <>
                          <div className="space-y-3">
                            {/* Top 3 Preview */}
                            {ranking.rankings.slice(0, 3).map((entry) => (
                              <div key={entry.productId} className="flex items-center gap-3">
                                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-white font-bold text-sm">
                                  {entry.rank}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium truncate">
                                    {entry.productName}
                                  </div>
                                  <div className="text-xs text-muted-foreground flex items-center gap-2">
                                    <span>NPS: {entry.metrics.npsScore.toFixed(0)}</span>
                                    {entry.metrics.trendDirection === 'up' && (
                                      <TrendingUp className="h-3 w-3 text-green-500" />
                                    )}
                                    {entry.metrics.trendDirection === 'down' && (
                                      <TrendingDown className="h-3 w-3 text-red-500" />
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>

                          <Button variant="outline" className="w-full mt-4 group-hover:bg-primary group-hover:text-primary-foreground">
                            View All Rankings →
                          </Button>
                        </>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          No products ranked yet in this category
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        )}

        {/* Methodology Section */}
        <Card className="mt-12 max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5" />
              How Rankings Work
            </CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none">
            <p className="text-muted-foreground">
              Our rankings are 100% data-driven and based on multiple signals:
            </p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><strong>NPS Score (25%):</strong> Net Promoter Score from verified user surveys</li>
              <li><strong>Sentiment (20%):</strong> AI-analyzed feedback sentiment from text responses</li>
              <li><strong>Engagement (20%):</strong> Survey completion rates and feedback volume</li>
              <li><strong>Volume (15%):</strong> Total number of verified responses</li>
              <li><strong>Recency (10%):</strong> Recent activity and fresh feedback</li>
              <li><strong>Trend (10%):</strong> Week-over-week improvement in metrics</li>
            </ul>
            <p className="text-sm text-muted-foreground mt-4">
              <strong>Minimum Requirements:</strong> Products must have at least 20 total responses 
              and 5 responses in the last 30 days to be eligible for ranking.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
