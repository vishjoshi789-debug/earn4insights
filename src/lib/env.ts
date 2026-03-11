/**
 * Runtime environment variable validation.
 * Import this module early (e.g. in layout.tsx or middleware) to fail fast
 * when required env vars are missing.
 *
 * Variables are grouped by criticality:
 *  - CRITICAL: app cannot start without these
 *  - OPTIONAL: features degrade gracefully when missing
 */

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `[ENV] Missing required environment variable: ${name}. ` +
      `The application cannot function correctly without it.`
    )
  }
  return value
}

function optionalEnv(name: string, fallback: string = ''): string {
  return process.env[name] || fallback
}

/** Validate all critical env vars. Call once at startup. */
export function validateEnvironment(): { valid: boolean; warnings: string[] } {
  const warnings: string[] = []

  // ── CRITICAL ────────────────────────────────────────────────
  // These throw if missing (handled by requireEnv callers).
  // We check them here softly so we can report ALL missing at once.
  const critical = [
    'POSTGRES_URL',
    'NEXTAUTH_SECRET',
  ] as const

  const missing: string[] = []
  for (const name of critical) {
    if (!process.env[name]) missing.push(name)
  }

  if (missing.length > 0) {
    throw new Error(
      `[ENV] Missing CRITICAL environment variables: ${missing.join(', ')}. ` +
      `The application cannot start.`
    )
  }

  // ── OPTIONAL (warn only) ────────────────────────────────────
  const optional: Array<{ name: string; feature: string }> = [
    { name: 'OPENAI_API_KEY', feature: 'AI transcription & theme extraction' },
    { name: 'RESEND_API_KEY', feature: 'Email notifications' },
    { name: 'TWILIO_ACCOUNT_SID', feature: 'WhatsApp notifications' },
    { name: 'TWILIO_AUTH_TOKEN', feature: 'WhatsApp notifications' },
    { name: 'GOOGLE_CLIENT_ID', feature: 'Google OAuth sign-in' },
    { name: 'GOOGLE_CLIENT_SECRET', feature: 'Google OAuth sign-in' },
    { name: 'ADMIN_API_KEY', feature: 'Admin API endpoints' },
    { name: 'NEXT_PUBLIC_GA_MEASUREMENT_ID', feature: 'Google Analytics' },
  ]

  for (const { name, feature } of optional) {
    if (!process.env[name]) {
      warnings.push(`[ENV] ${name} not set — ${feature} will be unavailable`)
    }
  }

  if (warnings.length > 0) {
    console.warn('⚠️ Environment warnings:')
    warnings.forEach(w => console.warn(`  ${w}`))
  }

  return { valid: true, warnings }
}

export { requireEnv, optionalEnv }
