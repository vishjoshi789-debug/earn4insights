import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

// ── Connection resolution ─────────────────────────────────────────────────
//
// Precedence: DATABASE_URL_OVERRIDE → POSTGRES_URL → DATABASE_URL
//
// WHY THE OVERRIDE EXISTS: the Neon Vercel integration owns both
// `POSTGRES_URL` and `DATABASE_URL` and scopes them to all three environments
// with no per-environment edit — Vercel only offers "rotate integration
// secrets". So there is no way to point a preview deployment at a different
// Neon branch using the canonical names.
//
// The name is deliberately environment-NEUTRAL. `PREVIEW_DATABASE_URL` would
// have solved today's problem and blocked the next one (staging,
// branch-per-PR), so this is "whatever environment sets it, wins".
//
// ⚠️ Disconnecting the integration was the alternative and was rejected: it
// would mean re-creating PRODUCTION's database configuration by hand on a
// live product, where a mistake is an outage. The override touches nothing in
// production's path.
const overrideUrl = process.env.DATABASE_URL_OVERRIDE

// ── 🔒 PRODUCTION GUARD — hard fail, not a warning ────────────────────────
//
// An override left set in production would silently point the live app at a
// different database: no error, no crash, just wrong data — reads returning
// someone else's rows, writes landing where nobody looks for them. That is
// the same silent-failure shape as the cron fail-open and the "sent" email
// status, and it is the worst of the three because it corrupts data rather
// than merely hiding it.
//
// So: **loud and down beats quiet and wrong.** A boot failure is discovered
// in seconds and fixed by deleting one variable, with zero data divergence.
// A misdirected database can run for days and may not be reversible.
//
// The escape hatch is deliberately a SECOND variable, so it cannot happen by
// accident — you have to mean it. Legitimate use: an emergency failover to a
// replica, or a provider migration.
const isProductionDeployment = process.env.VERCEL_ENV === 'production'
const overrideAllowedInProduction =
  process.env.ALLOW_DATABASE_URL_OVERRIDE_IN_PRODUCTION === 'true'

if (overrideUrl && isProductionDeployment && !overrideAllowedInProduction) {
  throw new Error(
    '[DB] REFUSING TO START: DATABASE_URL_OVERRIDE is set on a PRODUCTION ' +
    'deployment. This would silently point the live application at a ' +
    'different database. Remove the variable, or — if this is a deliberate ' +
    'failover — set ALLOW_DATABASE_URL_OVERRIDE_IN_PRODUCTION=true and ' +
    'redeploy. See src/db/index.ts for why this fails hard rather than warns.'
  )
}

if (overrideUrl && isProductionDeployment && overrideAllowedInProduction) {
  // Deliberate, but it should never be quiet. Logged at error level on every
  // cold start so it shows up in normal log filters, not just debug ones.
  console.error(
    '[DB] ⚠️ PRODUCTION IS RUNNING ON DATABASE_URL_OVERRIDE — explicitly ' +
    'permitted via ALLOW_DATABASE_URL_OVERRIDE_IN_PRODUCTION. This is not the ' +
    'integration-managed database. Unset both variables once the failover ends.'
  )
}

// Create postgres client optimized for serverless (Vercel + Neon)
const connectionString =
  overrideUrl || process.env.POSTGRES_URL || process.env.DATABASE_URL || ''

/**
 * Which env var actually produced the live connection. Exported so
 * `/api/admin/env-check` can report the EFFECTIVE source rather than
 * re-deriving the precedence chain and drifting from it.
 */
export const connectionSource: 'DATABASE_URL_OVERRIDE' | 'POSTGRES_URL' | 'DATABASE_URL' | 'none' =
  overrideUrl ? 'DATABASE_URL_OVERRIDE'
  : process.env.POSTGRES_URL ? 'POSTGRES_URL'
  : process.env.DATABASE_URL ? 'DATABASE_URL'
  : 'none'

if (!connectionString) {
  throw new Error(
    '[DB] Missing DATABASE_URL_OVERRIDE, POSTGRES_URL or DATABASE_URL ' +
    'environment variable. The application cannot start without a database ' +
    'connection.'
  )
}

const client = postgres(connectionString, {
  prepare: false,       // Required for Neon connection pooler (pgBouncer)
  idle_timeout: 20,     // Close idle connections after 20s in serverless
  max: 10,              // Limit connection pool size
  connect_timeout: 10,  // 10s connection timeout
})

export const db = drizzle(client, { schema })
export { sql } from 'drizzle-orm'

// Raw postgres.js client — use only for DDL migrations and raw multi-statement SQL.
// All application queries must go through `db` (Drizzle ORM).
export { client as pgClient }
