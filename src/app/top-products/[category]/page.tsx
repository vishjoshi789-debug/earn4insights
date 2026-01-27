import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getCurrentRanking } from '@/server/rankings/rankingStore'
import { getProductById } from '@/lib/product/store'
import { CATEGORY_ICONS, getCategoryName, type ProductCategory, CATEGORY_KEYS } from '@/lib/categories'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { TrendingUp, TrendingDown, Minus, Trophy, ArrowLeft, Star, ThumbsUp, MessageSquare, Users } from 'lucide-react'
import { RankingsViewTracker } from '../RankingsViewTracker'

type Props = {
  params: Promise<{ category: string }>
}

export async function generateMetadata({ params }: Props) {
  const { category } = await params
  const categoryName = getCategoryName(category as ProductCategory)
  
  return {
    title: `Top ${categoryName} Products | Earn4Insights`,
    description: `Discover the top-rated ${categoryName.toLowerCase()} products based on real user feedback and NPS scores.`,
  }
}

export async function generateStaticParams() {
  return CATEGORY_KEYS.map(category => ({ category }))
}

export default async function CategoryRankingPage({ params }: Props) {
  const { category } = await params
  
  // Validate category
  if (!CATEGORY_KEYS.includes(category as ProductCategory)) {
    notFound()
  }

  const categoryKey = category as ProductCategory
  const categoryName = getCategoryName(categoryKey)
  const ranking = await getCurrentRanking(categoryKey)

  if (!ranking || ranking.rankings.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <RankingsViewTracker category={categoryKey} />
        <div className="container mx-auto px-4 py-12">
          <Link href="/top-products">
            <Button variant="ghost" className="mb-6">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Categories
            </Button>
          </Link>

          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <div className="text-5xl mb-4 text-center">{CATEGORY_ICONS[categoryKey]}</div>
              <CardTitle className="text-center">{categoryName}</CardTitle>
              <CardDescription className="text-center">
                No products ranked yet in this category. Check back next week!
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    )
  }

  // Load product details for all ranked products
  const productsWithDetails = await Promise.all(
    ranking.rankings.map(async (entry) => {
      const product = await getProductById(entry.productId)
      return { ...entry, product }
    })
  )

  const weekStart = new Date(ranking.weekStart)
  const weekEnd = new Date(ranking.weekEnd)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <RankingsViewTracker category={categoryKey} />
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        <div className="container mx-auto px-4 py-12">
          <Link href="/top-products">
            <Button variant="ghost" className="mb-6 text-white hover:bg-white/20">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Categories
            </Button>
          </Link>

          <div className="flex items-center justify-center mb-4">
            <div className="text-6xl">{CATEGORY_ICONS[categoryKey]}</div>
          </div>
          
          <h1 className="text-4xl font-bold text-center mb-2">
            Top {categoryName} Products
          </h1>
          
          <p className="text-center text-blue-100 mb-4">
            Week of {weekStart.toLocaleDateString()} - {weekEnd.toLocaleDateString()}
          </p>

          <div className="flex justify-center gap-6 text-center mt-6">
            <div>
              <div className="text-2xl font-bold">{ranking.rankings.length}</div>
              <div className="text-sm text-blue-200">Top Products</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{ranking.totalProductsEvaluated}</div>
              <div className="text-sm text-blue-200">Evaluated</div>
            </div>
          </div>
        </div>
      </div>

      {/* Rankings */}
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto space-y-6">
          {productsWithDetails.map(({ rank, productId, productName, score, metrics, product }) => (
            <Card 
              key={productId}
              className={`relative overflow-hidden transition-all hover:shadow-xl ${
                rank === 1 ? 'border-yellow-400 border-2' : ''
              }`}
            >
              {/* Rank Badge */}
              <div className={`absolute top-0 left-0 w-16 h-16 flex items-center justify-center text-2xl font-bold ${
                rank === 1 ? 'bg-gradient-to-br from-yellow-400 to-orange-500' :
                rank === 2 ? 'bg-gradient-to-br from-gray-300 to-gray-400' :
                rank === 3 ? 'bg-gradient-to-br from-amber-600 to-amber-700' :
                'bg-gradient-to-br from-blue-500 to-blue-600'
              } text-white`}>
                #{rank}
              </div>

              {rank === 1 && (
                <div className="absolute top-4 right-4">
                  <Trophy className="h-8 w-8 text-yellow-500" />
                </div>
              )}

              <CardHeader className="pl-20">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-2xl mb-2">{productName}</CardTitle>
                    {product?.description && (
                      <CardDescription className="text-base">
                        {product.description}
                      </CardDescription>
                    )}
                  </div>
                  
                  {/* Trend Indicator */}
                  <Badge variant={
                    metrics.trendDirection === 'up' ? 'default' :
                    metrics.trendDirection === 'down' ? 'destructive' :
                    'secondary'
                  } className="flex items-center gap-1">
                    {metrics.trendDirection === 'up' && <TrendingUp className="h-3 w-3" />}
                    {metrics.trendDirection === 'down' && <TrendingDown className="h-3 w-3" />}
                    {metrics.trendDirection === 'stable' && <Minus className="h-3 w-3" />}
                    {metrics.weekOverWeekChange > 0 ? '+' : ''}{metrics.weekOverWeekChange.toFixed(1)}%
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="pl-20">
                {/* Metrics Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="bg-blue-50 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-blue-600 mb-1">
                      <Star className="h-4 w-4" />
                      <span className="text-xs font-medium">NPS Score</span>
                    </div>
                    <div className="text-2xl font-bold text-blue-700">
                      {metrics.npsScore.toFixed(0)}
                    </div>
                  </div>

                  <div className="bg-green-50 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-green-600 mb-1">
                      <ThumbsUp className="h-4 w-4" />
                      <span className="text-xs font-medium">Sentiment</span>
                    </div>
                    <div className="text-2xl font-bold text-green-700">
                      {(metrics.sentimentScore * 100).toFixed(0)}%
                    </div>
                  </div>

                  <div className="bg-purple-50 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-purple-600 mb-1">
                      <Users className="h-4 w-4" />
                      <span className="text-xs font-medium">Responses</span>
                    </div>
                    <div className="text-2xl font-bold text-purple-700">
                      {metrics.totalResponses}
                    </div>
                  </div>

                  <div className="bg-orange-50 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-orange-600 mb-1">
                      <MessageSquare className="h-4 w-4" />
                      <span className="text-xs font-medium">Rank Score</span>
                    </div>
                    <div className="text-2xl font-bold text-orange-700">
                      {(score * 100).toFixed(0)}
                    </div>
                  </div>
                </div>

                {/* Product Profile Link */}
                {product && (
                  <Link href={`/public-products/${productId}`}>
                    <Button variant="outline" className="w-full">
                      View Product Details →
                    </Button>
                  </Link>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Ranking Info */}
        <Card className="mt-12 max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle>About These Rankings</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              Rankings are updated weekly and based on verified user feedback collected through our platform.
            </p>
            <p>
              <strong>Last Updated:</strong> {new Date(ranking.generatedAt).toLocaleString()}
            </p>
            <p>
              <strong>Products Evaluated:</strong> {ranking.totalProductsEvaluated} in {categoryName}
            </p>
            <p className="pt-4">
              All scores are calculated using a weighted formula that considers NPS scores, sentiment analysis,
              engagement metrics, response volume, recency, and week-over-week trends.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
