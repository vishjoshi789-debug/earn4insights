import { BadgeCheck } from 'lucide-react'

/**
 * A9.2 — Compact "Verified" trust badge for influencer cards across
 * the platform. Mount anywhere an influencer's identity is shown:
 *   - /dashboard/brand/influencers list rows
 *   - Campaign-application cards (brand-side review)
 *   - Influencer marketplace public profile
 *   - Anywhere an avatar / display name is rendered
 *
 * Renders nothing when `verified` is false — safe to drop in
 * unconditionally next to a name without a wrapper check.
 *
 * Two sizes: `'sm'` (12px) for tight inline use next to a name, `'md'`
 * (14px) for card headers. Defaults to `'sm'`.
 */
export function VerifiedBadge({
  verified,
  size = 'sm',
  className = '',
  withLabel = false,
}: {
  verified: boolean | null | undefined
  size?: 'sm' | 'md'
  className?: string
  /** Add the "Verified" text after the icon. Off by default — most callsites just want the icon next to a name. */
  withLabel?: boolean
}) {
  if (!verified) return null
  const dim = size === 'md' ? 'h-4 w-4' : 'h-3.5 w-3.5'
  return (
    <span
      title="Verified influencer"
      aria-label="Verified influencer"
      className={`inline-flex items-center gap-1 text-blue-500 ${className}`}
    >
      <BadgeCheck className={dim} aria-hidden="true" />
      {withLabel && (
        <span className="text-xs font-medium">Verified</span>
      )}
    </span>
  )
}
