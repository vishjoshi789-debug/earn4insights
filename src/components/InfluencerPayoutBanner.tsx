'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Wallet, X, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * A10 L1 — soft prompt shown on the consumer dashboard when the user
 * has an influencer profile but no payout account yet.
 *
 * Mirrors the BrandOnboardingBanner pattern:
 *   - Dismissible per browser session (sessionStorage); reappears on
 *     next login so it can't be permanently buried.
 *   - Hydration-safe — renders nothing until after mount so the
 *     server-rendered initial paint matches.
 *   - `show` is decided server-side (influencer profile exists AND no
 *     payout account) — banner renders only when that's true.
 *
 * Counterpart hard-block lives in respondToInvitation + applyToCampaign
 * (L3 / L4). This banner is the gentle nudge; those are the safety net.
 */

const DISMISS_KEY = 'e4i-influencer-payout-banner-dismissed'

interface Props {
  show: boolean
}

export function InfluencerPayoutBanner({ show }: Props) {
  const [mounted, setMounted] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    setMounted(true)
    try {
      setDismissed(sessionStorage.getItem(DISMISS_KEY) === '1')
    } catch {
      /* private mode etc. */
    }
  }, [])

  if (!show || !mounted || dismissed) return null

  const dismiss = () => {
    setDismissed(true)
    try {
      sessionStorage.setItem(DISMISS_KEY, '1')
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 flex items-start gap-3">
      <div className="h-9 w-9 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
        <Wallet className="h-4 w-4 text-amber-600 dark:text-amber-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">
          Add your payout account
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          You'll need a payout account to receive payments from brand
          campaigns. Set it up now so you're ready when you accept your
          first campaign.
        </p>
        <div className="mt-2 flex gap-2">
          <Button asChild size="sm" className="h-8">
            <Link href="/dashboard/influencer/payouts">
              Add payout account <ArrowRight className="ml-1.5 h-3 w-3" />
            </Link>
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 text-muted-foreground"
            onClick={dismiss}
          >
            Later
          </Button>
        </div>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="text-muted-foreground hover:text-foreground p-1 -m-1"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
