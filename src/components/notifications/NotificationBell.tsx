'use client'

import { useState, useEffect } from 'react'
import { Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useRealtimeNotifications } from '@/hooks/useRealtimeNotifications'
import { NotificationDropdown } from '@/components/notifications/NotificationDropdown'
import { cn } from '@/lib/utils'

/**
 * NotificationBell — navbar bell icon with real-time unread badge.
 *
 * - Shows red badge with unread count (capped at 99+)
 * - Opens NotificationDropdown in a Popover on click
 * - Badge pulses when a new notification arrives via Pusher
 */
export function NotificationBell() {
  const { unreadCount, latestNotification, clearLatest, clearUnread } =
    useRealtimeNotifications()

  const [open, setOpen]           = useState(false)
  const [pulse, setPulse]         = useState(false)
  const [dropdownKey, setDropdownKey] = useState(0) // force re-render on new notification

  // Pulse animation when new notification arrives
  useEffect(() => {
    if (!latestNotification) return
    setPulse(true)
    setDropdownKey(k => k + 1)
    const t = setTimeout(() => { setPulse(false); clearLatest() }, 2000)
    return () => clearTimeout(t)
  }, [latestNotification, clearLatest])

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen)
  }

  const handleMarkAllRead = async () => {
    try {
      await fetch('/api/notifications/mark-all-read', { method: 'POST' })
      clearUnread()
    } catch {
      // Non-critical
    }
  }

  const badgeLabel = unreadCount > 99 ? '99+' : String(unreadCount)

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9"
          aria-label={unreadCount > 0 ? `${unreadCount} unread notifications` : 'Notifications'}
        >
          <Bell
            className={cn(
              'h-5 w-5 transition-transform',
              pulse && 'animate-bounce text-primary'
            )}
          />
          {unreadCount > 0 && (
            <span
              className={cn(
                'absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white',
                pulse && 'animate-pulse'
              )}
            >
              {badgeLabel}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        className="w-80 p-0"
        onOpenAutoFocus={e => e.preventDefault()}
      >
        <NotificationDropdown
          key={dropdownKey}
          onMarkAllRead={handleMarkAllRead}
          onClose={() => setOpen(false)}
        />
      </PopoverContent>
    </Popover>
  )
}
