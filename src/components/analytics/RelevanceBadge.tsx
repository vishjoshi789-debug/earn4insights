'use client'

import { cn } from '@/lib/utils'

type RelevanceTier = 'high' | 'medium' | 'low' | 'unknown'

const tierConfig: Record<RelevanceTier, { label: string; color: string; bg: string }> = {
  high: {
    label: 'High Relevance',
    color: 'text-emerald-700 dark:text-emerald-400',
    bg: 'bg-emerald-100 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800',
  },
  medium: {
    label: 'Medium Relevance',
    color: 'text-amber-700 dark:text-amber-400',
    bg: 'bg-amber-100 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800',
  },
  low: {
    label: 'Low Relevance',
    color: 'text-slate-600 dark:text-slate-400',
    bg: 'bg-slate-100 dark:bg-slate-900/30 border-slate-200 dark:border-slate-800',
  },
  unknown: {
    label: 'Unscored',
    color: 'text-slate-500 dark:text-slate-500',
    bg: 'bg-slate-50 dark:bg-slate-900/20 border-slate-200 dark:border-slate-800',
  },
}

/**
 * Visual badge showing how relevant a feedback source is
 * to the product — helping brands identify high-quality feedback.
 *
 * Score is computed from 7 data dimensions:
 *  Interest match, demographic fit, engagement level,
 *  behavioral signals, cultural alignment, purchase relevance, recency
 */
export function RelevanceBadge({
  score,
  tier,
  showScore = false,
  size = 'sm',
  className,
}: {
  score?: number
  tier?: RelevanceTier
  showScore?: boolean
  size?: 'xs' | 'sm' | 'md'
  className?: string
}) {
  const resolvedTier: RelevanceTier = tier
    || (score !== undefined
      ? score >= 60 ? 'high' : score >= 30 ? 'medium' : score > 0 ? 'low' : 'unknown'
      : 'unknown')

  const config = tierConfig[resolvedTier]

  const sizeClasses = {
    xs: 'text-[10px] px-1.5 py-0.5',
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border font-medium',
        config.bg,
        config.color,
        sizeClasses[size],
        className
      )}
      title={score !== undefined ? `Relevance Score: ${score}/100` : config.label}
    >
      <span className="inline-block w-1.5 h-1.5 rounded-full bg-current" />
      {config.label}
      {showScore && score !== undefined && (
        <span className="opacity-70">({score})</span>
      )}
    </span>
  )
}
