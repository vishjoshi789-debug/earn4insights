'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Bell, CheckCheck, ExternalLink, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'

interface NotificationItem {
  id:        string
  title:     string
  body:      string
  ctaUrl:    string | null
  type:      string
  isRead:    boolean
  createdAt: string
}

interface Props {
  onMarkAllRead: () => void
  onClose:       () => void
}

const TYPE_COLORS: Record<string, string> = {
  feedback_received: 'bg-blue-500',
  survey_completed:  'bg-green-500',
  survey_available:  'bg-emerald-500',
  product_launched:  'bg-purple-500',
  campaign_accepted: 'bg-violet-500',
  campaign_available:'bg-violet-400',
  milestone_submitted:'bg-orange-500',
  social_mention:    'bg-pink-500',
  brand_alert:       'bg-red-500',
  intent_signal:     'bg-yellow-500',
  community_post:    'bg-teal-500',
  influencer_post:   'bg-indigo-500',
}

/**
 * NotificationDropdown — shown inside the NotificationBell popover.
 * Fetches latest 10 notifications, groups by read/unread,
 * lets user mark individual items read, and links to full inbox.
 */
export function NotificationDropdown({ onMarkAllRead, onClose }: Props) {
  const [items, setItems]     = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/notifications/inbox?limit=10')
      .then(r => r.json())
      .then(data => { setItems(data.items ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const markRead = async (id: string) => {
    setItems(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n))
    await fetch(`/api/notifications/inbox/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isRead: true }),
    }).catch(() => {})
  }

  const handleMarkAllRead = async () => {
    setItems(prev => prev.map(n => ({ ...n, isRead: true })))
    onMarkAllRead()
  }

  const unread = items.filter(n => !n.isRead)

  return (
    <div className="flex flex-col bg-background text-foreground">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4" />
          <span className="font-semibold text-sm">Notifications</span>
          {unread.length > 0 && (
            <Badge variant="destructive" className="h-5 px-1.5 text-xs">
              {unread.length}
            </Badge>
          )}
        </div>
        {unread.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground"
            onClick={handleMarkAllRead}
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Mark all read
          </Button>
        )}
      </div>

      <Separator />

      {/* List */}
      <ScrollArea className="max-h-[360px]">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <Bell className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No notifications yet</p>
          </div>
        ) : (
          <div className="divide-y">
            {items.map(item => (
              <NotificationRow
                key={item.id}
                item={item}
                onRead={markRead}
                onNavigate={onClose}
              />
            ))}
          </div>
        )}
      </ScrollArea>

      <Separator />

      {/* Footer */}
      <div className="p-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-xs text-muted-foreground"
          asChild
          onClick={onClose}
        >
          <Link href="/dashboard/notifications">
            View all notifications
            <ExternalLink className="ml-1.5 h-3 w-3" />
          </Link>
        </Button>
      </div>
    </div>
  )
}

function NotificationRow({
  item,
  onRead,
  onNavigate,
}: {
  item:       NotificationItem
  onRead:     (id: string) => void
  onNavigate: () => void
}) {
  const dot = TYPE_COLORS[item.type] ?? 'bg-gray-400'

  const content = (
    <div
      className={cn(
        'flex gap-3 px-4 py-3 transition-colors hover:bg-muted/50 cursor-pointer',
        !item.isRead && 'bg-muted/40'
      )}
      onClick={() => { if (!item.isRead) onRead(item.id); onNavigate() }}
    >
      {/* Type indicator dot */}
      <div className="mt-1.5 shrink-0">
        <span className={cn('block h-2 w-2 rounded-full', dot)} />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <p className={cn('text-sm leading-snug !text-foreground', !item.isRead && 'font-medium')}>
          {item.title}
        </p>
        <p className="mt-0.5 text-xs !text-muted-foreground line-clamp-2">
          {item.body}
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground/70">
          {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
        </p>
      </div>

      {/* Unread indicator */}
      {!item.isRead && (
        <div className="mt-2 shrink-0">
          <span className="block h-1.5 w-1.5 rounded-full bg-blue-500" />
        </div>
      )}
    </div>
  )

  if (item.ctaUrl) {
    return <Link href={item.ctaUrl}>{content}</Link>
  }
  return content
}
