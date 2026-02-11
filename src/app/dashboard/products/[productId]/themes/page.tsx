import { getThemesForProduct } from '@/db/repositories/themeRepository'
import { getProductById } from '@/db/repositories/productRepository'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { Sparkles, TrendingUp, MessageSquare } from 'lucide-react'
import ExtractThemesButton from './ExtractThemesButton'

function SentimentIcon({ sentiment }: { sentiment: string }) {
  const icons: Record<string, string> = {
    positive: '😊',
    negative: '😟',
    neutral: '😐',
    mixed: '🔄',
  }
  return <span className="text-lg">{icons[sentiment] || '❓'}</span>
}

function SentimentBadge({ sentiment }: { sentiment: string }) {
  const colors: Record<string, string> = {
    positive: 'bg-green-900/30 text-green-400 border-green-700',
    negative: 'bg-red-900/30 text-red-400 border-red-700',
    neutral: 'bg-gray-800/30 text-gray-400 border-gray-600',
    mixed: 'bg-yellow-900/30 text-yellow-400 border-yellow-700',
  }
  return (
    <Badge variant="outline" className={colors[sentiment] || ''}>
      {sentiment}
    </Badge>
  )
}

export const dynamic = 'force-dynamic'

export default async function ProductThemesPage({
  params,
}: {
  params: Promise<{ productId: string }>
}) {
  const { productId } = await params

  let product: any = null
  let themes: any[] = []

  try {
    ;[product, themes] = await Promise.all([
      getProductById(productId),
      getThemesForProduct(productId),
    ])
  } catch {
    // Table may not exist yet
  }

  const productName = product?.name || productId

  // Aggregate stats
  const totalMentions = themes.reduce((sum, t) => sum + t.mentionCount, 0)
  const feedbackAnalyzed = themes[0]?.totalFeedbackAnalyzed ?? 0
  const extractionMethod = themes[0]?.extractionMethod ?? 'none'
  const lastExtracted = themes[0]?.extractedAt
    ? new Date(themes[0].extractedAt).toLocaleString()
    : 'Never'

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="space-y-1">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/dashboard/products" className="hover:underline">Products</Link>
          <span>/</span>
          <Link href={`/dashboard/products/${productId}`} className="hover:underline">
            {productName}
          </Link>
          <span>/</span>
          <span>AI Themes</span>
        </div>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-headline font-bold flex items-center gap-2">
              <Sparkles className="w-7 h-7 text-purple-400" />
              AI Theme Extraction
            </h1>
            <p className="text-muted-foreground">
              Auto-detected themes from user feedback for {productName}
            </p>
          </div>
          <ExtractThemesButton productId={productId} />
        </div>
      </header>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{themes.length}</div>
            <p className="text-sm text-muted-foreground">Themes Found</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{feedbackAnalyzed}</div>
            <p className="text-sm text-muted-foreground">Feedback Analyzed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{totalMentions}</div>
            <p className="text-sm text-muted-foreground">Total Mentions</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm font-medium capitalize">{extractionMethod}</div>
            <p className="text-sm text-muted-foreground">Method</p>
            <p className="text-xs text-muted-foreground mt-1">Last: {lastExtracted}</p>
          </CardContent>
        </Card>
      </div>

      {/* Themes list */}
      {themes.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Sparkles className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-lg font-semibold mb-1">No themes extracted yet</p>
            <p className="text-sm text-muted-foreground mb-4">
              Click &quot;Extract Themes&quot; above to analyze feedback and discover recurring topics.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {themes.map((theme) => (
            <Card key={theme.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <SentimentIcon sentiment={theme.sentiment} />
                    {theme.theme}
                  </CardTitle>
                  <SentimentBadge sentiment={theme.sentiment} />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Mention count bar */}
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    {theme.mentionCount} mention{theme.mentionCount !== 1 ? 's' : ''}
                  </span>
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-purple-500 rounded-full"
                      style={{
                        width: `${Math.min(100, (theme.mentionCount / Math.max(1, feedbackAnalyzed)) * 100)}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Example quotes */}
                {theme.examples && theme.examples.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" />
                      Example quotes
                    </p>
                    {theme.examples.map((example: string, i: number) => (
                      <blockquote
                        key={i}
                        className="text-xs text-muted-foreground bg-muted/50 border-l-2 border-purple-500/50 pl-3 py-1.5 rounded-r"
                      >
                        &quot;{example}&quot;
                      </blockquote>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
