'use client'

/**
 * WatchButton — Phase 1A
 *
 * A bell icon button that consumers can click to add/remove a product
 * from their watchlist. Shows filled bell when watching.
 */

import { useState, useEffect, useTransition } from 'react'
import { Bell, BellRing, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface WatchButtonProps {
  productId: string
  /** Optional: compact size for card layouts */
  size?: 'sm' | 'default'
  className?: string
}

export function WatchButton({ productId, size = 'default', className }: WatchButtonProps) {
  const [watching, setWatching] = useState(false)
  const [watchId, setWatchId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [loading, setLoading] = useState(true)

  // Check if already watching on mount
  useEffect(() => {
    async function check() {
      try {
        const res = await fetch(`/api/watchlist?productId=${productId}`)
        if (res.ok) {
          const data = await res.json()
          if (data.watching) {
            setWatching(true)
            setWatchId(data.entries?.[0]?.id || null)
          }
        }
      } catch {
        // Silently fail — button will show "not watching"
      } finally {
        setLoading(false)
      }
    }
    check()
  }, [productId])

  const toggle = () => {
    startTransition(async () => {
      if (watching && watchId) {
        // Remove from watchlist
        const res = await fetch(`/api/watchlist?id=${watchId}`, { method: 'DELETE' })
        if (res.ok) {
          setWatching(false)
          setWatchId(null)
        }
      } else {
        // Add to watchlist
        const res = await fetch('/api/watchlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productId, watchType: 'any' }),
        })
        if (res.ok) {
          const data = await res.json()
          setWatching(true)
          setWatchId(data.entry?.id || null)
        }
      }
    })
  }

  // ⚠️ An icon-only button with no accessible name is a control that does
  // something real and communicates nothing — the inverse of the false claims
  // this codebase keeps removing. Verified in production: the bell rendered
  // and worked, and the founder could not find it. The aria-label tracks
  // state so a screen reader hears the ACTION, not "button".
  const ariaLabel = watching ? 'Stop watching this product' : 'Watch this product'

  if (loading) {
    return (
      <Button
        variant="ghost"
        size={size === 'sm' ? 'icon' : 'default'}
        disabled
        className={className}
        aria-label="Checking watchlist"
        aria-busy="true"
      >
        <Loader2 className="h-4 w-4 animate-spin" />
      </Button>
    )
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={watching ? 'default' : 'outline'}
            size={size === 'sm' ? 'icon' : 'default'}
            onClick={toggle}
            disabled={isPending}
            className={className}
            aria-label={ariaLabel}
            aria-pressed={watching}
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : watching ? (
              <>
                <BellRing className="h-4 w-4" />
                {size !== 'sm' && <span className="ml-1">Watching</span>}
              </>
            ) : (
              <>
                <Bell className="h-4 w-4" />
                {size !== 'sm' && <span className="ml-1">Watch</span>}
              </>
            )}
          </Button>
        </TooltipTrigger>
        {/* Written from behaviour, not intent. Since migration 042 a Coming
            Soon product can be watched before launch, and the cron notifies
            watchers when it goes live \u2014 so the launch promise is now TRUE, but
            ONLY for Coming Soon products. Watching a product that has already
            launched does nothing beyond the list, and the copy must not imply
            otherwise. price_drop / feature updates still have no emitter and
            are not mentioned. */}
        <TooltipContent>
          {watching
            ? 'On your watchlist. Click to remove.'
            : 'Save to your watchlist. If it\u2019s Coming Soon, we\u2019ll tell you when it launches.'}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
