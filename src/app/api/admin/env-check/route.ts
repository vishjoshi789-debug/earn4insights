import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/admin/env-check
 * Header: x-api-key: <ADMIN_API_KEY>
 *
 * Answers one question that is otherwise pure guesswork: **is this
 * environment scoped correctly, or is it wearing production's clothes?**
 *
 * Vercel env vars default to "All Environments". A preview deployment
 * therefore inherits production values unless each one is explicitly scoped —
 * and the failure mode is not a crash, it is a preview deployment quietly
 * taking real card payments against the real database. That is not something
 * to verify by reading a dashboard list and hoping.
 *
 * ⚠️ NEVER RETURNS A SECRET. Only presence booleans, the key MODE
 * (`rzp_live_` vs `rzp_test_` — a prefix, not a key), and a database
 * HOSTNAME with credentials stripped. Adding a field here that echoes a value
 * would turn a diagnostic into a credential-disclosure endpoint.
 */

/** Extract just the host from a Postgres URL — never user, password or db. */
function dbHost(url: string | undefined): string | null {
  if (!url) return null
  try {
    return new URL(url).hostname
  } catch {
    return 'unparseable'
  }
}

/** `rzp_live_abc…` → `live`. Never returns the key. */
function razorpayMode(key: string | undefined): 'live' | 'test' | 'unset' | 'unrecognised' {
  if (!key) return 'unset'
  if (key.startsWith('rzp_live_')) return 'live'
  if (key.startsWith('rzp_test_')) return 'test'
  return 'unrecognised'
}

export async function GET(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key')
  if (!process.env.ADMIN_API_KEY || apiKey !== process.env.ADMIN_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 'production' | 'preview' | 'development' on Vercel; undefined locally.
  const vercelEnv = process.env.VERCEL_ENV ?? null
  const isProdDeployment = vercelEnv === 'production'

  const serverMode = razorpayMode(process.env.RAZORPAY_KEY_ID)
  const clientMode = razorpayMode(process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID)

  // Mirrors getAppBaseUrl() in emailVerificationService — the value that ends
  // up inside verification links. On a preview that inherited production's
  // NEXT_PUBLIC_APP_URL, a test signup emails a link to PRODUCTION, so the
  // token is consumed against the wrong deployment and the preview looks broken.
  const computedBaseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.AUTH_URL ||
    process.env.NEXTAUTH_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    'http://localhost:3000'

  const warnings: string[] = []

  // ── The one that costs real money ──────────────────────────────────────
  if (!isProdDeployment && (serverMode === 'live' || clientMode === 'live')) {
    warnings.push(
      'CRITICAL: LIVE Razorpay keys on a non-production deployment. A payment ' +
      'made here charges a real card. Scope RAZORPAY_KEY_ID and ' +
      'NEXT_PUBLIC_RAZORPAY_KEY_ID to Production only, and set rzp_test_ ' +
      'values for Preview.'
    )
  }
  if (serverMode !== clientMode) {
    warnings.push(
      `Razorpay key MODE MISMATCH: server=${serverMode}, client=${clientMode}. ` +
      'The checkout widget and the order-verification call would be talking to ' +
      'different Razorpay environments.'
    )
  }
  if (isProdDeployment && serverMode === 'test') {
    warnings.push('Production is on TEST Razorpay keys — real payments will not be captured.')
  }

  // ── Preview pointing at the production database ────────────────────────
  const host = dbHost(process.env.POSTGRES_URL || process.env.DATABASE_URL)
  if (!isProdDeployment && host && !/dev|test|staging|preview|branch/i.test(host)) {
    warnings.push(
      `Database host "${host}" does not look like a branch/dev database. A ` +
      'preview environment writing to production data can corrupt real ' +
      'records. Use a Neon branch for Preview.'
    )
  }

  // ── Base URL bleeding across environments ──────────────────────────────
  if (!isProdDeployment && /earn4insights\.com/i.test(computedBaseUrl)) {
    warnings.push(
      `Computed base URL is "${computedBaseUrl}" on a non-production deployment. ` +
      'Verification and reset links generated here will point at PRODUCTION. ' +
      'Leave NEXT_PUBLIC_APP_URL and AUTH_URL unset for Preview so VERCEL_URL wins.'
    )
  }

  // ── Things that silently disable a safety control ──────────────────────
  if (isProdDeployment && process.env.CSRF_ENFORCE !== 'true') {
    warnings.push('CSRF_ENFORCE is not "true" in production — CSRF is log-only.')
  }
  if (!process.env.RESEND_WEBHOOK_SECRET) {
    warnings.push(
      'RESEND_WEBHOOK_SECRET is unset — /api/webhooks/resend fails closed (503), ' +
      'so email delivery state stays blind (migration 035).'
    )
  }

  // Payments are meant to stay off until the campaign_payments ledger gap is
  // fixed and rehearsed. Warn on ENABLED (the risky state) and on a
  // server/client split, which would show brands a button that 503s.
  const payServer = process.env.PAYMENTS_ENABLED === 'true'
  const payClient = process.env.NEXT_PUBLIC_PAYMENTS_ENABLED === 'true'
  if (payServer) {
    warnings.push(
      'PAYMENTS_ENABLED is true — brands CAN be charged. This should stay off ' +
      'until the campaign_payments ledger gap is fixed and an end-to-end ' +
      'rehearsal has passed on test keys.'
    )
  }
  if (payServer !== payClient) {
    warnings.push(
      `Payment flag mismatch: server=${payServer}, client=${payClient}. ` +
      (payClient
        ? 'Brands see a Pay button that will 503.'
        : 'Payments are permitted server-side but the button is hidden.')
    )
  }

  return NextResponse.json(
    {
      ok: warnings.length === 0,
      environment: {
        vercelEnv,
        nodeEnv: process.env.NODE_ENV ?? null,
        vercelUrl: process.env.VERCEL_URL ?? null,
        computedBaseUrl,
      },
      razorpay: {
        serverKeyMode: serverMode,
        clientKeyMode: clientMode,
        webhookSecretSet: Boolean(process.env.RAZORPAY_WEBHOOK_SECRET),
      },
      database: { host },
      // Presence only — never the values.
      secretsPresent: {
        AUTH_SECRET: Boolean(process.env.AUTH_SECRET),
        ADMIN_API_KEY: Boolean(process.env.ADMIN_API_KEY),
        CRON_SECRET: Boolean(process.env.CRON_SECRET),
        RESEND_API_KEY: Boolean(process.env.RESEND_API_KEY),
        RESEND_WEBHOOK_SECRET: Boolean(process.env.RESEND_WEBHOOK_SECRET),
        BLOB_READ_WRITE_TOKEN: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
        OPENAI_API_KEY: Boolean(process.env.OPENAI_API_KEY),
        PUSHER_SECRET: Boolean(process.env.PUSHER_SECRET),
        CURRENT_ENCRYPTION_KEY_ID: Boolean(process.env.CURRENT_ENCRYPTION_KEY_ID),
      },
      payments: {
        // The kill-switch from lib/payments/paymentsEnabled.ts. Surfaced here
        // so "are payments actually blocked?" is a curl, not a memory.
        serverEnabled: process.env.PAYMENTS_ENABLED === 'true',
        clientEnabled: process.env.NEXT_PUBLIC_PAYMENTS_ENABLED === 'true',
      },
      flags: {
        CSRF_ENFORCE: process.env.CSRF_ENFORCE ?? null,
        NEXT_PUBLIC_WHATSAPP_ENABLED: process.env.NEXT_PUBLIC_WHATSAPP_ENABLED ?? null,
        RAZORPAYX_ENABLED: process.env.RAZORPAYX_ENABLED ?? null,
        ADMIN_DIAGNOSTICS_ENABLED: process.env.ADMIN_DIAGNOSTICS_ENABLED ?? null,
      },
      warnings,
    },
    { headers: { 'Cache-Control': 'private, no-store' } }
  )
}
