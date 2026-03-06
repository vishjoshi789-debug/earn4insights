import { getFeedbackByProduct, getFeedbackStats, getMediaForFeedbackIds } from '@/db/repositories/feedbackRepository'
import type { MediaItem } from '@/db/repositories/feedbackRepository'
import { getProductById } from '@/db/repositories/productRepository'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDistanceToNow } from 'date-fns'
import Link from 'next/link'
import { ExternalLink, Copy, MessageSquare } from 'lucide-react'
import FeedbackStatusButton from './FeedbackStatusButton'
import ShareFeedbackLink from './ShareFeedbackLink'
import { auth } from '@/lib/auth/auth.config'
import { redirect } from 'next/navigation'
import { getBrandSubscription } from '@/server/subscriptions/subscriptionService'
import UpgradePrompt from '@/app/dashboard/analytics/unified/UpgradePrompt'

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
    text: '💬', audio: '🎤', video: '🎥', mixed: '📎',
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
  const session = await auth()
  if (!session?.user?.id) {
    redirect('/login')
  }

  const { productId } = await params

  const [product, feedbackItems, stats, subscription] = await Promise.all([
    getProductById(productId),
    getFeedbackByProduct(productId, { limit: 100 }),
    getFeedbackStats(productId),
    getBrandSubscription(session.user.id),
  ])

  // Fetch media for all feedback items
  const feedbackIds = feedbackItems.map((f) => f.id)
  const mediaMap = await getMediaForFeedbackIds(feedbackIds)

  const productName = product?.name || productId

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
          <span>Feedback</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-headline font-bold">
              Direct Feedback
            </h1>
            <p className="text-muted-foreground">
              Consumer feedback submitted directly for {productName}
            </p>
          </div>
        </div>
      </header>

      {/* Shareable Link Card */}
      <ShareFeedbackLink productId={productId} productName={productName} />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
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
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-blue-600">
              {feedbackItems.filter((f) => f.status === 'new').length}
            </div>
            <p className="text-sm text-muted-foreground">Unreviewed</p>
          </CardContent>
        </Card>
      </div>

      {/* Pro Upgrade Prompt (free tier only) */}
      {subscription.tier === 'free' && (
        <UpgradePrompt
          title="Unlock Full Feedback Detail & Media Playback"
          description="You're on the Free plan. Upgrade to Pro to get the most out of your customer feedback."
          currentTier={subscription.tier}
          features={[
            'Read complete feedback text and AI-generated transcripts',
            'Play audio and video recordings submitted by customers',
            'See attached images in full resolution',
            'Export this product\'s feedback to CSV',
            'Filter by sentiment, modality, rating, and date range',
          ]}
        />
      )}

      {/* Feedback List */}
      {feedbackItems.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-lg font-semibold mb-1">No feedback yet</p>
            <p className="text-sm text-muted-foreground mb-4">
              Share the feedback link above with consumers to start collecting.
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
                    </div>

                    {/* Feedback text */}
                    <p className="text-sm">{item.feedbackText}</p>

                    {/* Normalized text */}
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

                    {/* Media Attachments */}
                    <FeedbackMediaSection media={mediaMap.get(item.id) || []} />

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

                  {/* Status action button (right side) */}
                  <div className="flex-shrink-0">
                    <FeedbackStatusButton
                      feedbackId={item.id}
                      currentStatus={item.status}
                    />
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

/* ── Media attachment renderer ── */
function FeedbackMediaSection({ media }: { media: MediaItem[] }) {
  if (media.length === 0) return null

  const audioItems = media.filter((m) => m.mediaType === 'audio')
  const videoItems = media.filter((m) => m.mediaType === 'video')
  const imageItems = media.filter((m) => m.mediaType === 'image')

  return (
    <div className="space-y-2 mt-2">
      {/* Audio player(s) */}
      {audioItems.map((a) => (
        <div key={a.id} className="flex items-center gap-2 bg-muted/40 rounded-lg p-2">
          <span className="text-sm">🎤</span>
          <audio controls preload="metadata" className="h-8 flex-1 min-w-0">
            <source src={a.storageKey} type={a.mimeType || 'audio/webm'} />
            Your browser does not support audio playback.
          </audio>
          {a.durationMs && (
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {Math.round(a.durationMs / 1000)}s
            </span>
          )}
        </div>
      ))}

      {/* Video player(s) */}
      {videoItems.map((v) => (
        <div key={v.id} className="rounded-lg overflow-hidden border bg-black">
          <video
            controls
            preload="metadata"
            className="w-full max-h-[300px]"
            playsInline
          >
            <source src={v.storageKey} type={v.mimeType || 'video/webm'} />
            Your browser does not support video playback.
          </video>
          {v.durationMs && (
            <div className="text-xs text-muted-foreground px-2 py-1 bg-muted/40">
              🎥 Video · {Math.round(v.durationMs / 1000)}s
            </div>
          )}
        </div>
      ))}

      {/* Image gallery */}
      {imageItems.length > 0 && (
        <div className={`grid gap-2 ${
          imageItems.length === 1 ? 'grid-cols-1' :
          imageItems.length === 2 ? 'grid-cols-2' :
          'grid-cols-3'
        }`}>
          {imageItems.map((img) => (
            <a
              key={img.id}
              href={img.storageKey}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-lg overflow-hidden border hover:ring-2 hover:ring-primary transition-all"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.storageKey}
                alt="Feedback attachment"
                className="w-full h-auto max-h-[200px] object-cover"
                loading="lazy"
              />
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
