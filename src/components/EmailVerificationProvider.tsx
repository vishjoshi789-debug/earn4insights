'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

/**
 * Shared email-verification state for the dashboard subtree.
 *
 * EV.2 had three independent pollers (banner, settings card, future
 * surfaces) hitting /api/auth/check-verification on their own 30s
 * cadence. EV.3 unifies that — one Provider mounted near the top of
 * dashboard/layout.tsx, one shared fetch, every consumer reads via
 * `useEmailVerification()`.
 *
 * Refresh strategy:
 *   - Fetch on mount
 *   - Re-fetch every 60s (background poll fallback)
 *   - Re-fetch when the tab regains focus (visibilitychange) —
 *     catches the "verified in another tab, came back here" case
 *     within a second
 *   - `refresh()` exposed for explicit revalidation after actions
 *     (e.g. just after the user clicks "Resend email" the banner
 *     can immediately re-poll without waiting for the 60s tick)
 *
 * Failure mode: fail-open. If the check endpoint errors, we surface
 * isLoading=false + isVerified=true → no nags fire. We'd rather let
 * an unverified user past the soft nudges than spam every verified
 * user with the modal on a transient backend hiccup. The actual
 * hard-block routes still gate on the server.
 */

type VerificationStatus = 'loading' | 'verified' | 'unverified' | 'error'

type ContextShape = {
  status: VerificationStatus
  isVerified: boolean
  isLoading: boolean
  verifiedAt: string | null
  refresh: () => Promise<void>
}

const POLL_INTERVAL_MS = 60_000

const EmailVerificationContext = createContext<ContextShape | null>(null)

export function EmailVerificationProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<VerificationStatus>('loading')
  const [verifiedAt, setVerifiedAt] = useState<string | null>(null)

  // De-dupe in-flight fetches — if focus + interval + manual refresh
  // all fire at once, only the first network call happens; the others
  // await its resolution.
  const inFlight = useRef<Promise<void> | null>(null)

  const fetchStatus = useCallback(async (): Promise<void> => {
    if (inFlight.current) return inFlight.current
    const p = (async () => {
      try {
        const res = await fetch('/api/auth/check-verification', {
          credentials: 'same-origin',
        })
        if (!res.ok) {
          // 401 here means session is gone — dashboard layout would
          // redirect; we treat as fail-open and stop nagging.
          setStatus('error')
          return
        }
        const data = (await res.json()) as {
          verified: boolean
          verifiedAt: string | null
        }
        setStatus(data.verified ? 'verified' : 'unverified')
        setVerifiedAt(data.verifiedAt)
      } catch {
        setStatus('error')
      }
    })()
    inFlight.current = p
    try {
      await p
    } finally {
      inFlight.current = null
    }
  }, [])

  // Initial fetch + interval poll.
  useEffect(() => {
    void fetchStatus()
    const id = setInterval(() => void fetchStatus(), POLL_INTERVAL_MS)
    return () => clearInterval(id)
  }, [fetchStatus])

  // Tab-focus revalidation — catches cross-tab verification quickly.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void fetchStatus()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [fetchStatus])

  const value = useMemo<ContextShape>(() => {
    // Fail-open: 'error' is treated as 'verified' for gating purposes
    // (don't nag everyone on a transient endpoint failure). The
    // server-side hard-block is still the source of truth.
    const isVerified = status === 'verified' || status === 'error'
    const isLoading = status === 'loading'
    return {
      status,
      isVerified,
      isLoading,
      verifiedAt,
      refresh: fetchStatus,
    }
  }, [status, verifiedAt, fetchStatus])

  return (
    <EmailVerificationContext.Provider value={value}>
      {children}
    </EmailVerificationContext.Provider>
  )
}

/**
 * Consume the shared email-verification state.
 *
 * Safe-fallback shape if used outside the provider (e.g. on a page
 * that doesn't mount the dashboard layout): returns a verified-looking
 * state so soft nudges hide rather than misfire. The provider is
 * mounted in dashboard/layout.tsx and covers every /dashboard/*
 * surface.
 */
export function useEmailVerification(): ContextShape {
  const ctx = useContext(EmailVerificationContext)
  if (!ctx) {
    return {
      status: 'verified',
      isVerified: true,
      isLoading: false,
      verifiedAt: null,
      refresh: async () => {},
    }
  }
  return ctx
}
