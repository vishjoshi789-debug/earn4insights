import { getFeedbackByProduct, getFeedbackStats } from '@/db/repositories/feedbackRepository'
import { getProductById } from '@/db/repositories/productRepository'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDistanceToNow } from 'date-fns'
import Link from 'next/link'

function SentimentBadge({ sentiment }: { sentiment: string | null }) {
  if (!sentiment) return <Badge variant="outline">Unknown</Badge>
  
  const colors: Record<string, string> = {
    positive: 'bg-green-50 text-green-700 border-green-200',
    negative: 'bg-red-50 text-red-700 border-red-200',
    neutral: 'bg-gray-50 text-gray-700 border-gray-200',
  }
  
  return (
    <Badge variant="outline" className={colors[sentiment] || ''}>
      {sentiment}
    </Badge>
  )
}

function ModalityBadge({ modality }: { modality: string }) {
  const icons: Record<string, string> = {
    text: '💬',
    audio: '🎤',
    video: '🎥',
    mixed: '📎',
  }
  
  return (
    <Badge variant="secondary" className="text-xs">
      {icons[modality] || '📝'} {modality}
    </Badge>
  )
}

function StarDisplay({ rating }: { rating: number | null }) {
  if (!rating) return null
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <span key={star} className={star <= rating ? 'text-yellow-400' : 'text-gray-200'}>
          ★
        </span>
      ))}
    </div>
  )
}

export default async function ProductFeedbackPage({
  params,
}: {
  params: Promise<{ productId: string }>
}) {
  const { productId } = await params
  
  const [product, feedbackItems, stats] = await Promise.all([
    getProductById(productId),
    getFeedbackByProduct(productId, { limit: 100 }),
    getFeedbackStats(productId),
  ])

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="space-y-1">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/dashboard/products" className="hover:underline">Products</Link>
          <span>/</span>
          <Link href={`/dashboard/products/${productId}`} className="hover:underline">
            {product?.name || productId}
          </Link>
          <span>/</span>
          <span>Feedback</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-headline font-bold">
          Direct Feedback
        </h1>
        <p className="text-muted-foreground">
          Consumer feedback submitted directly for this product
        </p>
      </header>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats.totalCount}</div>
            <p className="text-sm text-muted-foreground">Total Feedback</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {Number(stats.avgRating).toFixed(1)}
            </div>
            <p className="text-sm text-muted-foreground">Avg Rating</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <span className="text-green-600 font-bold">{stats.positiveCount}</span>
              <span className="text-muted-foreground">/</span>
              <span className="text-gray-600 font-bold">{stats.neutralCount}</span>
              <span className="text-muted-foreground">/</span>
              <span className="text-red-600 font-bold">{stats.negativeCount}</span>
            </div>
            <p className="text-sm text-muted-foreground">+/=/- Sentiment</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-1 text-sm">
              <span>💬 {stats.textCount}</span>
              <span>🎤 {stats.audioCount}</span>
              <span>🎥 {stats.videoCount}</span>
              <span>📎 {stats.mixedCount}</span>
            </div>
            <p className="text-sm text-muted-foreground">By Modality</p>
          </CardContent>
        </Card>
      </div>

      {/* Feedback List */}
      {feedbackItems.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No feedback yet for this product.</p>
            <p className="text-sm text-muted-foreground mt-1">
              Share the feedback link with consumers to start collecting.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {feedbackItems.map((item) => (
            <Card key={item.id}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    {/* Header row */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-sm">
                        {item.userName || 'Anonymous'}
                      </span>
                      <SentimentBadge sentiment={item.sentiment} />
                      <ModalityBadge modality={item.modalityPrimary} />
                      {item.category && item.category !== 'general' && (
                        <Badge variant="outline" className="text-xs">
                          {item.category}
                        </Badge>
                      )}
                      <Badge variant="outline" className={`text-xs ${
                        item.status === 'new' ? 'bg-blue-50 text-blue-700' :
                        item.status === 'reviewed' ? 'bg-yellow-50 text-yellow-700' :
                        'bg-green-50 text-green-700'
                      }`}>
                        {item.status}
                      </Badge>
                    </div>

                    {/* Feedback text */}
                    <p className="text-sm">{item.feedbackText}</p>

                    {/* Normalized text (if different from original) */}
                    {item.normalizedText && item.normalizedText !== item.feedbackText && (
                      <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                        <span className="font-medium">Translated:</span> {item.normalizedText}
                      </div>
                    )}

                    {/* Transcript */}
                    {item.transcriptText && (
                      <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                        <span className="font-medium">Transcript:</span> {item.transcriptText}
                      </div>
                    )}

                    {/* Footer */}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <StarDisplay rating={item.rating} />
                      {item.originalLanguage && (
                        <span>Lang: {item.originalLanguage}</span>
                      )}
                      <span>
                        {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
