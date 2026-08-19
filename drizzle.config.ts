import type { Config } from 'drizzle-kit'

/**
 * Same precedence as the app: DATABASE_URL_OVERRIDE → POSTGRES_URL → DATABASE_URL.
 * See `src/db/index.ts` for why the override exists.
 *
 * ⚠️ This previously read `POSTGRES_URL` EXCLUSIVELY, with no fallback — so
 * `drizzle-kit push` / `studio` would have silently ignored an override and
 * pointed at the integration-managed database instead. Running a schema push
 * against the wrong branch is exactly the accident the override is meant to
 * prevent, so the chain has to match.
 *
 * Deliberately NO production guard here: drizzle-kit is a local CLI run by a
 * human on purpose, not something a deployment boots. `VERCEL_ENV` is not even
 * set in that context. The guard lives where an accident would be silent —
 * the running application.
 */
const connectionString =
  process.env.DATABASE_URL_OVERRIDE ||
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL

export default {
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: connectionString!,
  },
} satisfies Config
