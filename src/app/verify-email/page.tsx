import Link from 'next/link'
import { CheckCircle2, XCircle, Clock, AlertCircle, Mail } from 'lucide-react'
import { verifyEmailToken } from '@/server/emailVerificationService'

// Always render fresh — never serve a cached response. Token state
// changes between requests (used_at gets set), and a cached success
// HTML would replay a stale "success" or stale "expired" panel for
// other users. Also defends against the "browser shows old page after
// deploy" failure mode we hit during EV.3 smoke testing.
export const dynamic = 'force-dynamic'

/**
 * /verify-email?token=…
 *
 * Server component — consumes the plaintext token from the URL,
 * hits verifyEmailToken(), and renders one of 5 states.
 *
 * States:
 *   A) Loading — handled implicitly (Next.js streams the result;
 *      RSC renders the final state directly, no separate loading UI).
 *   B) Success     — green check + auto-redirect to /dashboard via an
 *                    HTML `<meta http-equiv="refresh">` (pure
 *                    declarative, no JS, no hydration to fail). A
 *                    manual [Go to dashboard] Link is the always-works
 *                    escape hatch. Replaces an earlier client component
 *                    that triggered the error.tsx boundary for some
 *                    users during the router.push transition.
 *   C) Expired     — amber clock, [Send New Link] CTA → settings.
 *   D) Already used — neutral, [Go to Dashboard].
 *   E) Invalid     — red, [Go to Login] / [Sign up].
 *
 * No auth required — the token IS the auth. If the user is signed
 * in we still verify (verifyEmailToken is idempotent on success).
 */

type State =
  | { kind: 'success' }
  | { kind: 'expired' }
  | { kind: 'already_used' }
  | { kind: 'invalid' }
  | { kind: 'missing_token' }

async function resolveState(token: string | null): Promise<State> {
  if (!token) return { kind: 'missing_token' }
  const result = await verifyEmailToken(token)
  if (result.ok) return { kind: 'success' }
  if (result.reason === 'expired') return { kind: 'expired' }
  if (result.reason === 'already_used') return { kind: 'already_used' }
  return { kind: 'invalid' }
}

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams
  const state = await resolveState(token ?? null)

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 sm:p-8 shadow-sm">
        {state.kind === 'success' && <SuccessPanel />}
        {state.kind === 'expired' && <ExpiredPanel />}
        {state.kind === 'already_used' && <AlreadyUsedPanel />}
        {state.kind === 'invalid' && <InvalidPanel />}
        {state.kind === 'missing_token' && <InvalidPanel />}
      </div>
    </main>
  )
}

// ── Panels ──────────────────────────────────────────────────────────

function SuccessPanel() {
  return (
    <>
      <meta httpEquiv="refresh" content="3;url=/dashboard" />
      <div className="text-center space-y-4">
        <div className="mx-auto h-14 w-14 rounded-full bg-green-500/10 flex items-center justify-center">
          <CheckCircle2 className="h-8 w-8 text-green-500" aria-hidden="true" />
        </div>
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-foreground">Email verified</h1>
          <p className="text-sm text-muted-foreground">
            Welcome to Earn4Insights — your account is fully unlocked.
          </p>
          <p
            className="text-xs text-muted-foreground pt-2"
            aria-live="polite"
          >
            Redirecting to your dashboard in a few seconds…
          </p>
        </div>
        <div className="pt-2">
          {/* Plain <a> instead of <Link> — forces full page reload,
              identical to a direct URL-bar nav (which works). Avoids
              any client-side router transition that might be the
              root cause of the original error.tsx render. */}
          <a
            href="/dashboard"
            className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition w-full sm:w-auto"
          >
            Go to dashboard
          </a>
        </div>
      </div>
    </>
  )
}

function ExpiredPanel() {
  return (
    <div className="text-center space-y-4">
      <div className="mx-auto h-14 w-14 rounded-full bg-amber-500/10 flex items-center justify-center">
        <Clock className="h-8 w-8 text-amber-500" aria-hidden="true" />
      </div>
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-foreground">Link expired</h1>
        <p className="text-sm text-muted-foreground">
          Verification links are valid for 24 hours. Request a fresh one
          from your dashboard settings.
        </p>
      </div>
      <div className="pt-2">
        <Link
          href="/dashboard/settings"
          className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition"
        >
          <Mail className="mr-2 h-4 w-4" aria-hidden="true" />
          Send a new link
        </Link>
      </div>
    </div>
  )
}

function AlreadyUsedPanel() {
  return (
    <div className="text-center space-y-4">
      <div className="mx-auto h-14 w-14 rounded-full bg-muted flex items-center justify-center">
        <CheckCircle2 className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
      </div>
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-foreground">Already verified</h1>
        <p className="text-sm text-muted-foreground">
          This email is already verified. You can head straight to your dashboard.
        </p>
      </div>
      <div className="pt-2">
        <a
          href="/dashboard"
          className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition"
        >
          Go to dashboard
        </a>
      </div>
    </div>
  )
}

function InvalidPanel() {
  return (
    <div className="text-center space-y-4">
      <div className="mx-auto h-14 w-14 rounded-full bg-destructive/10 flex items-center justify-center">
        <XCircle className="h-8 w-8 text-destructive" aria-hidden="true" />
      </div>
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-foreground">Invalid link</h1>
        <p className="text-sm text-muted-foreground">
          This verification link isn&apos;t valid. It may have been
          mistyped or the original message was forwarded incorrectly.
        </p>
      </div>
      <div className="pt-2 flex flex-col sm:flex-row gap-2 justify-center">
        <Link
          href="/login"
          className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition"
        >
          Go to login
        </Link>
        <Link
          href="/signup"
          className="inline-flex h-10 items-center justify-center rounded-md border border-border bg-card px-4 text-sm font-medium text-foreground hover:bg-muted transition"
        >
          Create an account
        </Link>
      </div>
      <p className="text-xs text-muted-foreground pt-2 flex items-center justify-center gap-1.5">
        <AlertCircle className="h-3 w-3" aria-hidden="true" />
        Already signed up? Request a fresh link from your settings.
      </p>
    </div>
  )
}
