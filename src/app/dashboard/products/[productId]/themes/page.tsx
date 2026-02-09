import { getLatestThemesForProduct } from '@/db/repositories/themeRepository'
import { getProductById } from '@/db/repositories/productRepository'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { Sparkles, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import ExtractThemesButton from './ExtractThemesButton'

function SentimentIcon({ sentiment }: { sentiment: string }) {
  if (sentiment === 'positive') return <TrendingUp className="w-4 h-4 text-green-600" />
  if (sentiment === 'negative') return <TrendingDown className="w-4 h-4 text-red-600" />
  return <Minus className="w-4 h-4 text-gray-400" />
}

export default async function ProductThemesPage({
  params,
}: {
  params: Promise<{ productId: string }>
}) {
  const { productId } = await params
  const [product, themes] = await Promise.all([
    getProductById(productId),
    getLatestThemesForProduct(productId, 20),
  ])

  const productName = product?.name || productId

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/dashboard/products" className="hover:underline">Products</Link>
          <span>/</span>
          <Link href={`/dashboard/products/${productId}`} className="hover:underline">{productName}</Link>
          <span>/</span>
          <span>Themes</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-headline font-bold flex items-center gap-2">
              <Sparkles className="w-7 h-7 text-purple-600" />
              AI-Powered Themes
            </h1>
            <p className="text-muted-foreground mt-1">Recurring topics automatically extracted from consumer feedback</p>
          </div>
          <ExtractThemesButton productId={productId} />
        </div>
      </header>

      {themes.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Sparkles className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Themes Extracted Yet</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
              Click &quot;Extract Themes&quot; above to analyze all feedback and identify recurring topics using AI.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span><strong>{themes[0]?.totalFeedbackAnalyzed}</strong> feedback items analyzed</span>
            <span>&bull;</span>
            <span>Last extracted: {new Date(themes[0]?.extractedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {themes.map((theme) => (
              <Card key={theme.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <SentimentIcon sentiment={theme.sentiment} />
                      {theme.theme}
                    </CardTitle>
                    <Badge variant="secondary" className="text-xs">{theme.count} mentions</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <Badge variant="outline" className={`text-xs ${
                      theme.sentiment === 'positive' ? 'bg-green-50 text-green-700 border-green-200' :
                      theme.sentiment === 'negative' ? 'bg-red-50 text-red-700 border-red-200' :
                      'bg-gray-50 text-gray-700 border-gray-200'
                    }`}>{theme.sentiment}</Badge>

                    {theme.examples && theme.examples.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">Example quotes:</p>
                        {(theme.examples as string[]).slice(0, 2).map((example: string, idx: number) => (
                          <p key={idx} className="text-xs text-muted-foreground bg-muted/30 p-2 rounded italic line-clamp-2">
                            &quot;{example}&quot;
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
