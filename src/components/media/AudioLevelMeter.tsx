'use client'

import { useEffect, useState } from 'react'
import { MicOff } from 'lucide-react'
import {
  SILENCE_PEAK_THRESHOLD,
  type AudioLevelMonitor,
} from '@/lib/media/audioLevelMonitor'

type Props = {
  /** Live monitor for the current take, or null if we can't measure. */
  monitor: AudioLevelMonitor | null
  /** Whether recording is in progress (drives polling). */
  active: boolean
  className?: string
}

/**
 * Live microphone level bar shown while recording.
 *
 * The point is early warning: a user whose mic is muted previously saw a normal
 * timer and pulsing icon, recorded silence, and only found out never — because
 * nothing downstream told them either. A meter that stays flat is immediately
 * legible as "it isn't hearing me".
 *
 * Deliberately does NOT block anything by itself — the upload-time gate does
 * that. This is the part that lets the user fix the problem while they still
 * can.
 */
export default function AudioLevelMeter({ monitor, active, className = '' }: Props) {
  const [level, setLevel] = useState(0)
  const [everHeard, setEverHeard] = useState(false)

  useEffect(() => {
    if (!monitor || !active) return
    let raf = 0
    const tick = () => {
      const l = monitor.getLevel()
      setLevel(l)
      if (!monitor.isSilent()) setEverHeard(true)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [monitor, active])

  // Can't measure (no AudioContext) — render nothing rather than imply silence.
  if (!monitor || !active) return null

  // Compress for display: speech peaks are small in absolute terms, so a linear
  // bar would barely move. sqrt gives usable visual travel.
  const pct = Math.min(100, Math.round(Math.sqrt(level) * 100))
  const quiet = !everHeard

  return (
    <div className={`space-y-1 ${className}`}>
      <div className="flex items-center gap-2">
        <div
          className="h-2 flex-1 rounded-full bg-muted overflow-hidden"
          role="meter"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Microphone input level"
        >
          <div
            className={`h-full transition-[width] duration-75 ${
              quiet ? 'bg-amber-500' : 'bg-green-500'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-[11px] text-muted-foreground tabular-nums w-10 text-right">
          {pct}%
        </span>
      </div>

      {quiet && (
        <p className="flex items-center gap-1.5 text-[11px] text-amber-600 dark:text-amber-500">
          <MicOff className="h-3 w-3 shrink-0" />
          No sound detected yet — check your microphone isn&apos;t muted.
        </p>
      )}
    </div>
  )
}

export { SILENCE_PEAK_THRESHOLD }
