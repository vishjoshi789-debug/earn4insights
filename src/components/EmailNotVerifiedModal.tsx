'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Mail, Loader2, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { apiPost } from '@/lib/api-client'

/**
 * Global modal that listens for the `e4i:email-not-verified` window
 * event dispatched by api-client.ts whenever a mutating call returns
 * 403 with body `{ code: 'EMAIL_NOT_VERIFIED' }`.
 *
 * One mount in dashboard/layout.tsx covers every current + future
 * hard-blocked route — no per-callsite modal wiring needed.
 *
 * Behaviour:
 *   - Open: listener sets `open=true`; focus jumps to the first
 *     interactive element (resend button) via the close ref.
 *   - Resend: hits /api/auth/resend-verification (apiPost auto-CSRF).
 *   - 429: shows cooldown using retryAfter.
 *   - Close: ESC, backdrop click, or [Cancel] / [X] button. Focus
 *     returns to the previously-active element.
 */

type EventDetail = {
  code?: string
  cta?: string
  error?: string
}

export function EmailNotVerifiedModal() {
  const [open, setOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [cooldownSec, setCooldownSec] = useState(0)

  const previouslyFocused = useRef<HTMLElement | null>(null)
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const firstFocusableRef = useRef<HTMLButtonElement | null>(null)

  // ── Event subscription ───────────────────────────────────────────
  useEffect(() => {
    const onTrigger = (e: Event) => {
      // Defensive — only open if event payload actually claims
      // EMAIL_NOT_VERIFIED. Avoids accidental fires from generic 403s.
      const detail = (e as CustomEvent<EventDetail>).detail
      if (detail?.code !== 'EMAIL_NOT_VERIFIED') return
      previouslyFocused.current = document.activeElement as HTMLElement | null
      setOpen(true)
      setSent(false)
    }
    window.addEventListener('e4i:email-not-verified', onTrigger as EventListener)
    return () => {
      window.removeEventListener('e4i:email-not-verified', onTrigger as EventListener)
    }
  }, [])

  // ── Cooldown tick ────────────────────────────────────────────────
  useEffect(() => {
    if (cooldownSec <= 0) return
    const t = setTimeout(() => setCooldownSec((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldownSec])

  // ── Focus management ─────────────────────────────────────────────
  useEffect(() => {
    if (!open) {
      // Restore focus to the element that triggered the modal.
      previouslyFocused.current?.focus?.()
      return
    }
    // Focus the primary action on mount; falls back to dialog body.
    queueMicrotask(() => {
      firstFocusableRef.current?.focus?.()
    })
  }, [open])

  // ── ESC to close ─────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  // ── Handlers ─────────────────────────────────────────────────────
  const close = useCallback(() => setOpen(false), [])

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
      }
    } finally {
      setSending(false)
    }
  }

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="email-not-verified-title"
      aria-describedby="email-not-verified-desc"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm overflow-y-auto"
      onMouseDown={(e) => {
        // Close on backdrop click but NOT when clicking inside the
        // dialog itself. mousedown (not click) avoids "drag end on
        // backdrop closes" false-positives.
        if (e.target === e.currentTarget) close()
      }}
    >
      <div
        ref={dialogRef}
        className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg my-auto"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
            <Mail className="h-5 w-5 text-amber-500" aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <h2
              id="email-not-verified-title"
              className="text-base font-semibold text-foreground"
            >
              Email verification required
            </h2>
            <p
              id="email-not-verified-desc"
              className="text-sm text-muted-foreground mt-1"
            >
              To complete this action, please verify your email first.
              Check your inbox for the verification link, or request a
              new one below.
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close dialog"
            className="text-muted-foreground hover:text-foreground p-1 -m-1"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 flex flex-col sm:flex-row gap-2 sm:justify-end">
          <Button
            variant="ghost"
            onClick={close}
            className="order-2 sm:order-1"
          >
            Cancel
          </Button>
          <Button
            ref={firstFocusableRef}
            onClick={resend}
            disabled={sending || cooldownSec > 0}
            aria-label="Resend verification email"
            className="order-1 sm:order-2"
          >
            {sending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                Sending…
              </>
            ) : sent ? (
              <>
                <Check className="mr-2 h-4 w-4" aria-hidden="true" />
                Sent — check your inbox
              </>
            ) : cooldownSec > 0 ? (
              `Try again in ${cooldownSec}s`
            ) : (
              'Resend verification email'
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
