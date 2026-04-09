'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import {
  Bell, CheckCheck, Trash2, Filter, Loader2, RefreshCw, InboxIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import { useRealtimeNotifications } from '@/hooks/useRealtimeNotifications'

interface NotificationItem {
  id:        string
  title:     string
  body:      string
  ctaUrl:    string | null
  type:      string
  isRead:    boolean
  createdAt: string
  expiresAt: string
}

const NOTIFICATION_TYPES = [
  { value: 'all',                label: 'All' },
  { value: 'feedback_received',  label: 'Feedback' },
  { value: 'survey_completed',   label: 'Surveys' },
  { value: 'brand_alert',        label: 'Alerts' },
  { value: 'social_mention',     label: 'Mentions' },
  { value: 'campaign_accepted',  label: 'Campaigns' },
  { value: 'intent_signal',      label: 'Intent' },
]

const TYPE_COLORS: Record<string, string> = {
  feedback_received:  'bg-blue-500',
  survey_completed:   'bg-green-500',
  survey_available:   'bg-emerald-500',
  product_launched:   'bg-purple-500',
  campaign_accepted:  'bg-violet-500',
  campaign_available: 'bg-violet-400',
  milestone_submitted:'bg-orange-500',
  social_mention:     'bg-pink-500',
  brand_alert:        'bg-red-500',
  intent_signal:      'bg-yellow-500',
  community_post:     'bg-teal-500',
  influencer_post:    'bg-indigo-500',
}

/**
 * NotificationInbox — full-page notification history.
 * - Filter by type
 * - Toggle unread-only
 * - Mark individual read/unread
 * - Dismiss (delete) individual items
 * - Mark all read
 * - Infinite scroll via cursor-based pagination
 * - Real-time: new items arrive via Pusher (useRealtimeNotifications)
 */
export function NotificationInbox() {
  const [items, setItems]           = useState<NotificationItem[]>([])
  const [loading, setLoading]       = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore]       = useState(false)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [typeFilter, setTypeFilter] = useState('all')
  const [unreadOnly, setUnreadOnly] = useState(false)

  const { unreadCount, latestNotification, clearLatest, clearUnread } =
    useRealtimeNotifications()

  // Fetch (or re-fetch) the first page
  const fetchPage = useCallback(async (reset = true) => {
    reset ? setLoading(true) : setLoadingMore(true)

    const params = new URLSearchParams({ limit: '25' })
    if (typeFilter !== 'all') params.set('type', typeFilter)
    if (unreadOnly) params.set('unreadOnly', 'true')

    try {
      const res  = await fetch(`/api/notifications/inbox?${params}`)
      const data = await res.json()
      const newItems: NotificationItem[] = data.items ?? []

      setItems(reset ? newItems : prev => [...prev, ...newItems])
      setHasMore(data.hasMore ?? false)
      setNextCursor(data.nextCursor ?? null)
    } finally {
      reset ? setLoading(false) : setLoadingMore(false)
    }
  }, [typeFilter, unreadOnly])

  useEffect(() => { fetchPage(true) }, [fetchPage])

  // Prepend real-time notifications that arrive via Pusher
  useEffect(() => {
    if (!latestNotification) return
    const newItem: NotificationItem = {
      id:        latestNotification.id ?? crypto.randomUUID(),
      title:     latestNotification.title,
      body:      latestNotification.body,
      ctaUrl:    latestNotification.ctaUrl,
      type:      latestNotification.type,
      isRead:    false,
      createdAt: latestNotification.createdAt,
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
    }
    setItems(prev => [newItem, ...prev])
    clearLatest()
  }, [latestNotification, clearLatest])

  // Load more (infinite scroll)
  const loadMore = async () => {
    if (!hasMore || loadingMore || !nextCursor) return
    setLoadingMore(true)

    const params = new URLSearchParams({ limit: '25', before: nextCursor })
    if (typeFilter !== 'all') params.set('type', typeFilter)
    if (unreadOnly) params.set('unreadOnly', 'true')

    const res  = await fetch(`/api/notifications/inbox?${params}`)
    const data = await res.json()

    setItems(prev => [...prev, ...(data.items ?? [])])
    setHasMore(data.hasMore ?? false)
    setNextCursor(data.nextCursor ?? null)
    setLoadingMore(false)
  }

  const markRead = async (id: string) => {
    setItems(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n))
    await fetch(`/api/notifications/inbox/${id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ isRead: true }),
    }).catch(() => {})
  }

  const markUnread = async (id: string) => {
    setItems(prev => prev.map(n => n.id === id ? { ...n, isRead: false } : n))
    await fetch(`/api/notifications/inbox/${id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ isRead: false }),
    }).catch(() => {})
  }

  const dismiss = async (id: string) => {
    setItems(prev => prev.filter(n => n.id !== id))
    await fetch(`/api/notifications/inbox/${id}`, { method: 'DELETE' }).catch(() => {})
  }

  const markAllRead = async () => {
    setItems(prev => prev.map(n => ({ ...n, isRead: true })))
    clearUnread()
    await fetch('/api/notifications/mark-all-read', { method: 'POST' }).catch(() => {})
  }

  const currentUnread = items.filter(n => !n.isRead).length

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-8 w-[140px] text-xs">
              <Filter className="mr-1.5 h-3.5 w-3.5" />
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              {NOTIFICATION_TYPES.map(t => (
                <SelectItem key={t.value} value={t.value} className="text-xs">
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant={unreadOnly ? 'secondary' : 'outline'}
            size="sm"
            className="h-8 text-xs"
            onClick={() => setUnreadOnly(v => !v)}
          >
            {unreadOnly ? 'Unread only' : 'All'}
            {unreadCount > 0 && (
              <Badge variant="destructive" className="ml-1.5 h-4 px-1 text-[10px]">
                {unreadCount}
              </Badge>
            )}
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {currentUnread > 0 && (
            <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs" onClick={markAllRead}>
              <CheckCheck className="h-3.5 w-3.5" />
              Mark all read
            </Button>
          )}
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => fetchPage(true)}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <InboxIcon className="h-12 w-12 text-muted-foreground/30" />
          <p className="text-sm font-medium text-muted-foreground">
            {unreadOnly ? 'No unread notifications' : 'No notifications yet'}
          </p>
          <p className="text-xs text-muted-foreground/70">
            Notifications appear here and are kept for 90 days
          </p>
        </div>
      ) : (
        <div className="rounded-lg border divide-y overflow-hidden">
          {items.map(item => (
            <InboxRow
              key={item.id}
              item={item}
              onMarkRead={markRead}
              onMarkUnread={markUnread}
              onDismiss={dismiss}
            />
          ))}
        </div>
      )}

      {/* Load more */}
      {hasMore && !loading && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadMore}
            disabled={loadingMore}
          >
            {loadingMore ? (
              <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />Loading…</>
            ) : (
              'Load more'
            )}
          </Button>
        </div>
      )}
    </div>
  )
}

function InboxRow({
  item,
  onMarkRead,
  onMarkUnread,
  onDismiss,
}: {
  item:         NotificationItem
  onMarkRead:   (id: string) => void
  onMarkUnread: (id: string) => void
  onDismiss:    (id: string) => void
}) {
  const [showActions, setShowActions] = useState(false)
  const dot = TYPE_COLORS[item.type] ?? 'bg-gray-400'

  const rowContent = (
    <div
      className={cn(
        'flex gap-3 px-4 py-3 transition-colors',
        !item.isRead && 'bg-blue-50/40 dark:bg-blue-950/10',
        showActions && 'bg-muted/40'
      )}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className="mt-1.5 shrink-0">
        <span className={cn('block h-2 w-2 rounded-full', dot)} />
      </div>

      <div className="min-w-0 flex-1">
        <p className={cn('text-sm leading-snug', !item.isRead && 'font-medium')}>
          {item.title}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{item.body}</p>
        <p className="mt-1 text-[11px] text-muted-foreground/60">
          {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
        </p>
      </div>

      {/* Action buttons — shown on hover */}
      <div className={cn('flex shrink-0 items-start gap-1 transition-opacity', showActions ? 'opacity-100' : 'opacity-0')}>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          title={item.isRead ? 'Mark unread' : 'Mark read'}
          onClick={e => { e.preventDefault(); item.isRead ? onMarkUnread(item.id) : onMarkRead(item.id) }}
        >
          <CheckCheck className={cn('h-3.5 w-3.5', item.isRead && 'text-muted-foreground')} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-destructive"
          title="Dismiss"
          onClick={e => { e.preventDefault(); onDismiss(item.id) }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )

  if (item.ctaUrl) {
    return (
      <Link href={item.ctaUrl} onClick={() => { if (!item.isRead) onMarkRead(item.id) }}>
        {rowContent}
      </Link>
    )
  }
  return rowContent
}
