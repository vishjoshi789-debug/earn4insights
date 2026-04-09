'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Activity, Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import { usePusher } from '@/hooks/usePusher'
import { useSession } from 'next-auth/react'
import { userChannel, PUSHER_EVENTS } from '@/lib/pusher-client'

interface FeedItem {
  id:          string
  eventType:   string
  actorId:     string | null
  actorRole:   string | null
  title:       string
  description: string | null
  entityType:  string | null
  entityId:    string | null
  metadata:    Record<string, unknown> | null
  createdAt:   string
}

const EVENT_ICONS: Record<string, string> = {
  'consumer.feedback.submitted':  '💬',
  'consumer.survey.completed':    '📋',
  'brand.product.launched':       '🚀',
  'brand.survey.created':         '📝',
  'brand.campaign.launched':      '📣',
  'influencer.post.published':    '✨',
  'influencer.campaign.accepted': '🤝',
  'influencer.milestone.completed': '✅',
  'social.mention.detected':      '📡',
  'brand.alert.fired':            '🔔',
  'consumer.product.browsed':     '👁️',
  'consumer.community.posted':    '💭',
}

interface Props {
  /** Max items to show */
  limit?: number
  /** Show a "Load more" button */
  paginated?: boolean
  className?: string
}

/**
 * ActivityFeed — live activity stream for the dashboard home page.
 *
 * - Fetches initial items from /api/notifications/inbox (activity_feed_items)
 * - Updates in real-time via Pusher (ACTIVITY_FEED_UPDATE event)
 * - Supports infinite scroll when paginated=true
 */
export function ActivityFeed({ limit = 10, paginated = false, className }: Props) {
  const { data: session } = useSession()
  const userId = (session?.user as any)?.id as string | undefined

  const [items, setItems]           = useState<FeedItem[]>([])
  const [loading, setLoading]       = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore]       = useState(false)
  const [nextCursor, setNextCursor] = useState<string | null>(null)

  const fetchItems = useCallback(async (cursor?: string) => {
    cursor ? setLoadingMore(true) : setLoading(true)
    try {
      const params = new URLSearchParams({ limit: String(limit) })
      if (cursor) params.set('before', cursor)

      const res  = await fetch(`/api/activity-feed?${params}`)
      if (!res.ok) throw new Error('fetch failed')
      const data = await res.json()

      setItems(prev => cursor ? [...prev, ...(data.items ?? [])] : (data.items ?? []))
      setHasMore(data.hasMore ?? false)
      setNextCursor(data.nextCursor ?? null)
    } catch {
      // Non-critical — feed is optional
    } finally {
      cursor ? setLoadingMore(false) : setLoading(false)
    }
  }, [limit])

  useEffect(() => { fetchItems() }, [fetchItems])

  // Real-time feed update via Pusher
  const handleFeedUpdate = useCallback((data: unknown) => {
    const item = data as FeedItem
    if (!item?.id) return
    setItems(prev => {
      // Avoid duplicate if item already in list
      if (prev.some(i => i.id === item.id)) return prev
      return [item, ...prev.slice(0, limit - 1)]
    })
  }, [limit])

  usePusher({
    channelName: userId ? userChannel(userId) : '',
    events: { [PUSHER_EVENTS.ACTIVITY_FEED_UPDATE]: handleFeedUpdate },
    enabled: !!userId,
  })

  if (loading) {
    return (
      <div className={cn('flex items-center justify-center py-8', className)}>
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className={cn('flex flex-col items-center gap-2 py-8 text-center', className)}>
        <Activity className="h-8 w-8 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">No activity yet</p>
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Recent Activity</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={() => fetchItems()}
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="space-y-1">
        {items.map(item => (
          <FeedRow key={item.id} item={item} />
        ))}
      </div>

      {paginated && hasMore && (
        <Button
          variant="ghost"
          size="sm"
          className="mt-2 w-full text-xs text-muted-foreground"
          onClick={() => nextCursor && fetchItems(nextCursor)}
          disabled={loadingMore}
        >
          {loadingMore
            ? <><Loader2 className="mr-1.5 h-3 w-3 animate-spin" />Loading…</>
            : 'Load more'}
        </Button>
      )}
    </div>
  )
}

function FeedRow({ item }: { item: FeedItem }) {
  const icon = EVENT_ICONS[item.eventType] ?? '📌'

  const row = (
    <div className="flex items-start gap-3 rounded-md px-2 py-2 transition-colors hover:bg-muted/40">
      <span className="mt-0.5 text-base leading-none">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug">{item.title}</p>
        {item.description && (
          <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
            {item.description}
          </p>
        )}
        <p className="mt-0.5 text-[11px] text-muted-foreground/60">
          {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
        </p>
      </div>
    </div>
  )

  // Link to entity if available
  const href = resolveEntityHref(item)
  if (href) {
    return <Link href={href}>{row}</Link>
  }
  return row
}

function resolveEntityHref(item: FeedItem): string | null {
  if (!item.entityType || !item.entityId) return null
  switch (item.entityType) {
    case 'product':  return `/products/${item.entityId}`
    case 'survey':   return `/surveys/${item.entityId}`
    case 'campaign': return `/dashboard/brand/campaigns/${item.entityId}`
    default:         return null
  }
}
