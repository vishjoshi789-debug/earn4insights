'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { usePresenceChannel } from '@/hooks/usePusher'
import { PRESENCE_DASHBOARD, productChannel } from '@/lib/pusher-client'
import { useSession } from 'next-auth/react'

// ── Online dot ─────────────────────────────────────────────────────────────

interface OnlineDotProps {
  /** userId to check presence for */
  userId: string
  className?: string
}

/**
 * OnlineDot — shows a green dot if the given user is currently online.
 * Subscribes to the presence-dashboard channel.
 */
export function OnlineDot({ userId, className }: OnlineDotProps) {
  const { data: session } = useSession()
  const currentUserId = (session?.user as any)?.id as string | undefined
  const { isMemberOnline } = usePresenceChannel(PRESENCE_DASHBOARD, !!currentUserId)

  const [online, setOnline] = useState(false)

  useEffect(() => {
    // Poll every 10s — presence channel handles the truth,
    // but we refresh the derived state periodically
    const check = () => setOnline(isMemberOnline(userId))
    check()
    const interval = setInterval(check, 10_000)
    return () => clearInterval(interval)
  }, [userId, isMemberOnline])

  if (!online) return null

  return (
    <span
      className={cn(
        'inline-block h-2 w-2 rounded-full bg-green-500 ring-2 ring-background',
        className
      )}
      title="Online"
      aria-label="Online"
    />
  )
}

// ── Active users counter ───────────────────────────────────────────────────

interface ActiveUsersCountProps {
  className?: string
  /** Label format: "%d users viewing" */
  label?: string
}

/**
 * ActiveUsersCount — shows "X users currently viewing" on product/public pages.
 * Subscribes to a product public channel or the global presence channel.
 */
export function ActiveUsersCount({ className, label = '%d viewing' }: ActiveUsersCountProps) {
  const { data: session } = useSession()
  const currentUserId = (session?.user as any)?.id as string | undefined
  const { getMemberCount } = usePresenceChannel(PRESENCE_DASHBOARD, !!currentUserId)

  const [count, setCount] = useState(0)

  useEffect(() => {
    const update = () => setCount(getMemberCount())
    update()
    const interval = setInterval(update, 15_000)
    return () => clearInterval(interval)
  }, [getMemberCount])

  if (count <= 1) return null  // Don't show if only the current user

  return (
    <span className={cn('flex items-center gap-1.5 text-xs text-muted-foreground', className)}>
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
      </span>
      {label.replace('%d', String(count))}
    </span>
  )
}

// ── Brand active badge ─────────────────────────────────────────────────────

interface BrandActiveBadgeProps {
  brandUserId: string
  className?:  string
}

/**
 * BrandActiveBadge — shows "Brand is active" to consumers when the brand
 * has an active dashboard session (is in the presence channel).
 */
export function BrandActiveBadge({ brandUserId, className }: BrandActiveBadgeProps) {
  const { data: session } = useSession()
  const currentUserId = (session?.user as any)?.id as string | undefined
  const { isMemberOnline } = usePresenceChannel(PRESENCE_DASHBOARD, !!currentUserId)

  const [active, setActive] = useState(false)

  useEffect(() => {
    const check = () => setActive(isMemberOnline(brandUserId))
    check()
    const interval = setInterval(check, 10_000)
    return () => clearInterval(interval)
  }, [brandUserId, isMemberOnline])

  if (!active) return null

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-400',
        className
      )}
    >
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-500" />
      </span>
      Brand is active
    </span>
  )
}
