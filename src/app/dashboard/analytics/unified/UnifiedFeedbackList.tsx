'use client'

import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { MessageSquare, Mic, Video, TrendingUp } from 'lucide-react'
import type { UnifiedFeedbackItem } from '@/server/analytics/unifiedAnalyticsService'

interface Props {
  items: UnifiedFeedbackItem[]
}

export default function UnifiedFeedbackList({ items }: Props) {
  if (items.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>No feedback items found</p>
        <p className="text-sm mt-2">Try adjusting your filters</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <Card key={item.id} className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              {/* Source badge */}
              <Badge variant={item.source === 'survey' ? 'default' : 'secondary'}>
                {item.source === 'survey' ? '📊 Survey' : '💬 Feedback'}
              </Badge>
              
              {/* Modality icon */}
              {item.modality === 'audio' && <Mic className="w-4 h-4 text-purple-500" />}
              {item.modality === 'video' && <Video className="w-4 h-4 text-pink-500" />}
              {item.modality === 'image' && (
                <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              )}
              
              {/* Sentiment badge */}
              {item.sentiment && (
                <Badge
                  variant="outline"
                  className={
                    item.sentiment === 'positive'
                      ? 'border-green-200 bg-green-50 text-green-700'
                      : item.sentiment === 'negative'
                      ? 'border-red-200 bg-red-50 text-red-700'
                      : 'border-gray-200 bg-gray-50 text-gray-700'
                  }
                >
                  {item.sentiment === 'positive' && '😊'}
                  {item.sentiment === 'neutral' && '😐'}
                  {item.sentiment === 'negative' && '😞'}
                  {' '}
                  {item.sentiment}
                </Badge>
              )}
              
              {/* Rating */}
              {item.rating !== undefined && (
                <Badge variant="outline">
                  ⭐ {item.rating}
                </Badge>
              )}
            </div>
            
            <div className="text-xs text-muted-foreground">
              {new Date(item.createdAt).toLocaleDateString()}
            </div>
          </div>

          {/* Feedback text */}
          <div className="mb-3">
            <p className="text-sm">{item.text || 'No text content'}</p>
            {item.originalLanguage && item.originalLanguage !== 'en' && (
              <p className="text-xs text-muted-foreground mt-1">
                Originally in {item.originalLanguage}
              </p>
            )}
          </div>

          {/* Media indicators */}
          {item.mediaCount > 0 && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Attachments:</span>
              {item.hasAudio && <span className="flex items-center gap-1"><Mic className="w-3 h-3" /> Audio</span>}
              {item.hasVideo && <span className="flex items-center gap-1"><Video className="w-3 h-3" /> Video</span>}
              {item.hasImages && <span className="flex items-center gap-1">🖼️ {item.hasImages ? 'Images' : 'Image'}</span>}
            </div>
          )}

          {/* User info */}
          {(item.userName || item.userEmail) && (
            <div className="mt-3 pt-3 border-t text-xs text-muted-foreground">
              {item.userName && <span>From: {item.userName}</span>}
              {item.userEmail && <span className="ml-2">({item.userEmail})</span>}
            </div>
          )}

          {/* Source-specific metadata */}
          {item.metadata.surveyTitle && (
            <div className="mt-2 text-xs text-muted-foreground">
              Survey: {item.metadata.surveyTitle}
            </div>
          )}
          {item.metadata.feedbackCategory && (
            <div className="mt-2 text-xs text-muted-foreground">
              Category: {item.metadata.feedbackCategory}
            </div>
          )}
        </Card>
      ))}
    </div>
  )
}
