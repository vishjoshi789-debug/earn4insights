'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle2, Mail, Loader2, Check } from 'lucide-react'
import { apiPost } from '@/lib/api-client'

/**
 * Account-settings card showing email verification state.
 *
 * Two render branches:
 *   - Verified   → green check, "Verified on <date>"
 *   - Unverified → mail icon, [Resend Verification Email] button with
 *                  cooldown on 429
 *
 * Polls /api/auth/check-verification once on mount + every 30s while
 * mounted. Resend hits /api/auth/resend-verification via apiPost
 * (auto-CSRF). Mirrors the banner's behaviour so the two stay in sync
 * — the cross-tab "did I just verify?" path works from either surface.
 */

const POLL_INTERVAL_MS = 30_000

type Status = 'loading' | 'unverified' | 'verified' | 'error'

function formatVerifiedAt(iso: string | null): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return iso
  }
}

export function EmailVerificationCard() {
  const [status, setStatus] = useState<Status>('loading')
  const [verifiedAt, setVerifiedAt] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [cooldownSec, setCooldownSec] = useState(0)

  const checkStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/check-verification', {
        credentials: 'same-origin',
      })
      if (!res.ok) {
        setStatus('error')
        return
      }
      const data = (await res.json()) as { verified: boolean; verifiedAt: string | null }
      setStatus(data.verified ? 'verified' : 'unverified')
      setVerifiedAt(data.verifiedAt)
    } catch {
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    void checkStatus()
    const id = setInterval(() => void checkStatus(), POLL_INTERVAL_MS)
    return () => clearInterval(id)
  }, [checkStatus])

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
      }
    } finally {
      setSending(false)
    }
  }

  // While loading, render a slim skeleton so the layout doesn't jump.
  if (status === 'loading') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Email verification</CardTitle>
          <CardDescription>Checking status…</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (status === 'verified') {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-500" aria-hidden="true" />
            <CardTitle>Email verified</CardTitle>
          </div>
          <CardDescription>
            {verifiedAt
              ? `Verified on ${formatVerifiedAt(verifiedAt)}`
              : 'Your email address is verified.'}
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  // Unverified — and error states fall through here (treat as
  // "unverified" UX, the resend button is still a sensible action).
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-amber-500" aria-hidden="true" />
          <CardTitle>Email not verified</CardTitle>
        </div>
        <CardDescription>
          Verify your email to unlock feedback submission, redemptions,
          campaigns, and payments. Links expire after 24 hours.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          onClick={resend}
          disabled={sending || cooldownSec > 0}
          aria-label="Resend verification email"
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
            <>
              <Mail className="mr-2 h-4 w-4" aria-hidden="true" />
              Resend verification email
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  )
}
