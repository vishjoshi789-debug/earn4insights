'use client'

import { useCallback, useEffect, useState } from 'react'
import { Mail, X, Loader2, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { apiPost } from '@/lib/api-client'

/**
 * Soft prompt shown at the top of the dashboard layout when the
 * logged-in user has NOT yet verified their email.
 *
 * Behaviour:
 *   - Polls /api/auth/check-verification once on mount + once per
 *     30s while visible — picks up cross-tab verification without
 *     a page reload.
 *   - Dismissible per browser session (sessionStorage); reappears
 *     on next login. Auto-hides permanently once verified.
 *   - Resend button hits /api/auth/resend-verification via apiPost
 *     (auto-CSRF). On 429, displays a cooldown using the
 *     retryAfter seconds in the response body.
 *
 * Mirrors the BrandOnboardingBanner pattern (sessionStorage dismiss
 * key, mounted gate, ghost dismiss button).
 */

const DISMISS_KEY = 'e4i-email-verification-banner-dismissed'
const POLL_INTERVAL_MS = 30_000

type Status = 'loading' | 'unverified' | 'verified' | 'error'

export function EmailVerificationBanner() {
  const [mounted, setMounted] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [status, setStatus] = useState<Status>('loading')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [cooldownSec, setCooldownSec] = useState(0)

  // ── Mount + dismiss state ────────────────────────────────────────
  useEffect(() => {
    setMounted(true)
    try {
      setDismissed(sessionStorage.getItem(DISMISS_KEY) === '1')
    } catch {
      /* private mode etc. */
    }
  }, [])

  // ── Polling: detect cross-tab verification ───────────────────────
  const checkStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/check-verification', {
        credentials: 'same-origin',
      })
      if (!res.ok) {
        // 401 here = not logged in; the dashboard layout would have
        // redirected. Treat as silent skip.
        setStatus('error')
        return
      }
      const data = (await res.json()) as { verified: boolean }
      setStatus(data.verified ? 'verified' : 'unverified')
    } catch {
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    if (!mounted || dismissed) return
    void checkStatus()
    const id = setInterval(() => void checkStatus(), POLL_INTERVAL_MS)
    return () => clearInterval(id)
  }, [mounted, dismissed, checkStatus])

  // ── Cooldown tick ────────────────────────────────────────────────
  useEffect(() => {
    if (cooldownSec <= 0) return
    const t = setTimeout(() => setCooldownSec((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldownSec])

  // ── Handlers ─────────────────────────────────────────────────────
  const dismiss = () => {
    setDismissed(true)
    try {
      sessionStorage.setItem(DISMISS_KEY, '1')
    } catch {
      /* ignore */
    }
  }

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
        // Reset the "sent" tick after a few seconds so the button
        // doesn't get stuck looking like a permanent success.
        setTimeout(() => setSent(false), 4000)
      }
    } finally {
      setSending(false)
    }
  }

  // ── Render gate ─────────────────────────────────────────────────
  if (!mounted || dismissed) return null
  if (status !== 'unverified') return null

  // ── Banner ──────────────────────────────────────────────────────
  return (
    <div
      role="status"
      aria-live="polite"
      className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 flex items-start gap-3"
    >
      <div className="h-9 w-9 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
        <Mail className="h-4 w-4 text-amber-500" aria-hidden="true" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">
          Verify your email to unlock all features
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          We sent a verification link when you signed up. Some actions
          (feedback, redemptions, campaigns, payments) need a verified
          email before they&apos;ll go through.
        </p>
        <div className="mt-2 flex flex-col sm:flex-row gap-2">
          <Button
            size="sm"
            className="h-8"
            onClick={resend}
            disabled={sending || cooldownSec > 0}
            aria-label="Resend verification email"
          >
            {sending ? (
              <>
                <Loader2 className="mr-1.5 h-3 w-3 animate-spin" aria-hidden="true" />
                Sending…
              </>
            ) : sent ? (
              <>
                <Check className="mr-1.5 h-3 w-3" aria-hidden="true" />
                Sent — check inbox
              </>
            ) : cooldownSec > 0 ? (
              `Try again in ${cooldownSec}s`
            ) : (
              'Resend email'
            )}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 text-muted-foreground"
            onClick={dismiss}
          >
            Dismiss for now
          </Button>
        </div>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss banner"
        className="text-muted-foreground hover:text-foreground p-1 -m-1"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
