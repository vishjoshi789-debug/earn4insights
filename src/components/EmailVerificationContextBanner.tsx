'use client'

import { useEffect, useState } from 'react'
import { Mail, Loader2, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { apiPost } from '@/lib/api-client'
import { useEmailVerification } from '@/components/EmailVerificationProvider'

/**
 * Layer 2 — per-page contextual banner shown above gated workflows.
 *
 * Unlike the dashboard Layer-1 banner (EmailVerificationBanner):
 *   - Not dismissable (contextual reminder for THIS page's action)
 *   - Compact one-line layout
 *   - Custom context message via `context` prop
 *   - Resend button uses shared provider's refresh() after sending
 *
 * Mount at the top of each page whose primary CTA hits a hard-
 * blocked route. Hides itself when user is verified (or while
 * loading / on error to avoid flicker + fail-open).
 *
 * Usage:
 *   <EmailVerificationContextBanner
 *     context="Verify your email to submit feedback and earn rewards."
 *     ctaLabel="Verify now"  // optional, defaults to "Resend email"
 *   />
 */

type Props = {
  context: string
  ctaLabel?: string
}

export function EmailVerificationContextBanner({ context, ctaLabel }: Props) {
  const { isVerified, isLoading, refresh } = useEmailVerification()
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [cooldownSec, setCooldownSec] = useState(0)

  useEffect(() => {
    if (cooldownSec <= 0) return
    const t = setTimeout(() => setCooldownSec((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldownSec])

  const resend = async () => {
    if (sending || cooldownSec > 0) return
    setSending(true)
    setSent(false)
    try {
      const res = await apiPost('/api/auth/resend-verification')
      if (res.status === 429) {
        const body = await res.json().catch(() => ({}))
        const retry = Number(body?.retryAfter ?? 60)
        setCooldownSec(Math.min(retry, 3600))
        return
      }
      if (res.ok) {
        setSent(true)
        setTimeout(() => setSent(false), 4000)
        // Re-check the shared state in case the user happened to
        // verify between this mount and the click — keeps Layer 1+2+3
        // in sync without waiting for the next poll tick.
        void refresh()
      }
    } finally {
      setSending(false)
    }
  }

  // Hide while loading + when verified. Failure (status='error') is
  // treated as verified by the provider — same fail-open.
  if (isLoading || isVerified) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3"
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <Mail
          className="h-4 w-4 text-amber-500 shrink-0"
          aria-hidden="true"
        />
        <p className="text-sm text-foreground truncate">{context}</p>
      </div>
      <Button
        size="sm"
        className="h-8 shrink-0"
        onClick={resend}
        disabled={sending || cooldownSec > 0}
        aria-label={ctaLabel ?? 'Resend verification email'}
      >
        {sending ? (
          <>
            <Loader2 className="mr-1.5 h-3 w-3 animate-spin" aria-hidden="true" />
            Sending…
          </>
        ) : sent ? (
          <>
            <Check className="mr-1.5 h-3 w-3" aria-hidden="true" />
            Sent
          </>
        ) : cooldownSec > 0 ? (
          `${cooldownSec}s`
        ) : (
          (ctaLabel ?? 'Verify now')
        )}
      </Button>
    </div>
  )
}
