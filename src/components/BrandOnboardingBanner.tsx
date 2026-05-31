'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Building2, X, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Soft prompt shown on the brand dashboard when the brand has NOT yet
 * completed the onboarding wizard.
 *
 * Behaviour:
 *   - Dismissible per browser session (sessionStorage) — reappears on
 *     next login so the brand can't permanently bury it.
 *   - Renders nothing when the wizard is complete (controlled by the
 *     `show` prop from the server component above it).
 *
 * Lives separately from the wizard guard because we don't want to
 * force-redirect EXISTING brands into the wizard. The Guard's force
 * is for new accounts; this banner is the gentle migration path for
 * brands who were created before Phase 3A shipped.
 */

const DISMISS_KEY = 'e4i-brand-onboarding-banner-dismissed'

interface Props {
  show: boolean
}

export function BrandOnboardingBanner({ show }: Props) {
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

  // Hydration-safe: render nothing until after mount so server output
  // matches the initial client render (which doesn't yet know dismiss
  // state). Once mounted we honour both `show` and `dismissed`.
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
    <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 flex items-start gap-3">
      <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
        <Building2 className="h-4 w-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">
          Complete your brand profile
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Set up company details, billing info, and audience targeting.
          Required for invoicing and unlocks better influencer matching.
        </p>
        <div className="mt-2 flex gap-2">
          <Button asChild size="sm" className="h-8">
            <Link href="/onboarding">
              Set up now <ArrowRight className="ml-1.5 h-3 w-3" />
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
