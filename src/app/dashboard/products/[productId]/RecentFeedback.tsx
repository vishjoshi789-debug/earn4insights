import { getFeedbackByProduct, getMediaForFeedbackIds } from '@/db/repositories/feedbackRepository'
import type { MediaItem } from '@/db/repositories/feedbackRepository'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDistanceToNow } from 'date-fns'
import Link from 'next/link'
import { MessageSquare, ExternalLink } from 'lucide-react'

/**
 * Server component: Recent Consumer Feedback with full media display.
 * Rendered directly on the product detail page so brands see
 * audio, video, images, ratings, and sentiment at a glance.
 */
export default async function RecentFeedback({
  productId,
  productName,
}: {
  productId: string
  productName: string
}) {
  let items: Awaited<ReturnType<typeof getFeedbackByProduct>> = []
  let mediaMap = new Map<string, MediaItem[]>()

  try {
    items = await getFeedbackByProduct(productId, { limit: 5 })
    if (items.length > 0) {
      mediaMap = await getMediaForFeedbackIds(items.map((i) => i.id))
    }
  } catch {
    // DB may not have the tables yet — render empty
  }

  const totalCount = items.length

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <MessageSquare className="h-5 w-5 text-blue-500" />
          Recent Consumer Feedback
        </CardTitle>
        <div className="flex items-center gap-2">
          <Link
            href={`/submit-feedback/${productId}`}
            target="_blank"
            className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
          >
            <ExternalLink className="w-3 h-3" />
            Share feedback link
          </Link>
          <Button asChild size="sm" variant="outline">
            <Link href={`/dashboard/products/${productId}/feedback`}>
              View all feedback →
            </Link>
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {items.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium mb-1">No feedback yet</p>
            <p className="text-sm">
              Share the feedback link with consumers to start collecting reviews for{' '}
              {productName}.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((item) => {
              const media = mediaMap.get(item.id) || []
              return (
                <div
                  key={item.id}
                  className="border rounded-lg p-4 space-y-2"
                >
                  {/* Header: name, sentiment, modality, rating */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-sm">
                      {item.userName || 'Anonymous'}
                    </span>

                    {item.sentiment && (
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${
                          item.sentiment === 'positive'
                            ? 'bg-green-50 text-green-700 border-green-200'
                            : item.sentiment === 'negative'
                              ? 'bg-red-50 text-red-700 border-red-200'
                              : 'bg-gray-50 text-gray-700 border-gray-200'
                        }`}
                      >
                        {item.sentiment}
                      </Badge>
                    )}

                    <Badge variant="secondary" className="text-[10px]">
                      {item.modalityPrimary === 'audio'
                        ? '🎤 audio'
                        : item.modalityPrimary === 'video'
                          ? '🎥 video'
                          : item.modalityPrimary === 'mixed'
                            ? '📎 mixed'
                            : '💬 text'}
                    </Badge>

                    {item.rating && (
                      <div className="flex items-center gap-0.5 ml-auto">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <span
                            key={s}
                            className={`text-sm ${s <= item.rating! ? 'text-yellow-400' : 'text-gray-300'}`}
                          >
                            ★
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Feedback text */}
                  <p className="text-sm text-foreground">{item.feedbackText}</p>

                  {/* Transcript if present */}
                  {item.transcriptText && (
                    <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                      <span className="font-medium">Transcript:</span>{' '}
                      {item.transcriptText}
                    </div>
                  )}

                  {/* ── Media: audio / video / images ── */}
                  <FeedbackMediaInline media={media} />

                  {/* Timestamp */}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1">
                    {item.originalLanguage && (
                      <span>Lang: {item.originalLanguage}</span>
                    )}
                    <span>
                      {formatDistanceToNow(new Date(item.createdAt), {
                        addSuffix: true,
                      })}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/* ── Inline media renderer (audio / video / images) ── */
function FeedbackMediaInline({ media }: { media: MediaItem[] }) {
  if (media.length === 0) return null

  const audioItems = media.filter((m) => m.mediaType === 'audio')
  const videoItems = media.filter((m) => m.mediaType === 'video')
  const imageItems = media.filter((m) => m.mediaType === 'image')

  return (
    <div className="space-y-2">
      {/* Audio */}
      {audioItems.map((a) => (
        <div
          key={a.id}
          className="flex items-center gap-2 bg-muted/40 rounded-lg p-2"
        >
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

      {/* Video */}
      {videoItems.map((v) => (
        <div key={v.id} className="rounded-lg overflow-hidden border bg-black">
          <video
            controls
            preload="metadata"
            className="w-full max-h-[280px]"
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

      {/* Images */}
      {imageItems.length > 0 && (
        <div
          className={`grid gap-2 ${
            imageItems.length === 1
              ? 'grid-cols-1'
              : imageItems.length === 2
                ? 'grid-cols-2'
                : 'grid-cols-3'
          }`}
        >
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
                className="w-full h-auto max-h-[180px] object-cover"
                loading="lazy"
              />
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
