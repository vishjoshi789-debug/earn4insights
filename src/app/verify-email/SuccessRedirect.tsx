'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Client child of /verify-email success state. Renders a live
 * countdown ("Redirecting to dashboard in 3s…") and a [Go to
 * Dashboard] button that fires the redirect immediately.
 *
 * The countdown is purely UX — the redirect fires at 0 regardless
 * of whether the user clicked the button or not. aria-live keeps
 * the countdown announcement non-intrusive for screen readers.
 *
 * Defensive: `router.push` uses Next.js client-side navigation which
 * fetches the destination's RSC payload. If that RSC fetch throws
 * (e.g. a transient hiccup in /dashboard server rendering) the user
 * lands on the error boundary instead of the dashboard. The fallback
 * here is a full-page `window.location.assign` — slower but bypasses
 * RSC entirely so it works even when the RSC stream errors. Both
 * paths get the user to /dashboard; the fallback just costs ~one
 * extra request.
 */
function goToDashboard(router: ReturnType<typeof useRouter>): void {
  try {
    router.push('/dashboard')
  } catch (err) {
    console.error('[SuccessRedirect] router.push failed; falling back to full nav:', err)
    if (typeof window !== 'undefined') {
      window.location.assign('/dashboard')
    }
  }
}

export function SuccessRedirect({ seconds }: { seconds: number }) {
  const router = useRouter()
  const [remaining, setRemaining] = useState(seconds)

  useEffect(() => {
    if (remaining <= 0) {
      goToDashboard(router)
      return
    }
    const t = setTimeout(() => setRemaining((n) => n - 1), 1000)
    return () => clearTimeout(t)
  }, [remaining, router])

  return (
    <div className="pt-2 space-y-2">
      <p
        className="text-xs text-muted-foreground"
        aria-live="polite"
        aria-atomic="true"
      >
        Redirecting to dashboard in <span className="font-medium text-foreground">{remaining}s</span>…
      </p>
      <button
        type="button"
        onClick={() => goToDashboard(router)}
        className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition w-full sm:w-auto"
      >
        Go to dashboard
      </button>
    </div>
  )
}
