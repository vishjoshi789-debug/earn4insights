'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'

/**
 * Subtle, dismissible "on our roadmap" teaser banner.
 *
 * Roadmap-framed (NO dates) on purpose — we don't repeat the false 14-day-trial
 * promise. Dismissal persists per-id in localStorage so it doesn't nag.
 */
export function RoadmapBanner({ id, children }: { id: string; children: React.ReactNode }) {
  const storageKey = `e4i_roadmap_${id}`
  // Start hidden to avoid a flash before we can read localStorage.
  const [hidden, setHidden] = useState(true)

  useEffect(() => {
    try {
      setHidden(localStorage.getItem(storageKey) === '1')
    } catch {
      setHidden(false)
    }
  }, [storageKey])

  if (hidden) return null

  return (
    <div className="relative rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 pr-9 text-sm text-muted-foreground">
      <div>{children}</div>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => {
          try { localStorage.setItem(storageKey, '1') } catch { /* ignore */ }
          setHidden(true)
        }}
        className="absolute right-2 top-2 rounded-md p-1 text-muted-foreground/60 hover:bg-muted hover:text-foreground"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
