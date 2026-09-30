/**
 * TEMPORARY read-only schema-drift sweep. Delete after use.
 *
 * Answers the question the migration-route grep only approximates:
 * which tables does the app EXPECT (schema.ts) that the database does NOT have,
 * and which does the database have that the schema does not declare?
 *
 * Static analysis of CREATE TABLE in migration routes tells you what is
 * *documented* in the sequence. This tells you what is actually *there*.
 */
import postgres from 'postgres'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const url = process.env.DATABASE_URL_OVERRIDE || process.env.POSTGRES_URL || process.env.DATABASE_URL
if (!url) { console.error('No connection string'); process.exit(1) }

const sql = postgres(url, { ssl: 'require', max: 1, idle_timeout: 20, connect_timeout: 60 })

/**
 * Neon's pooler cold-starts: the first query after idle regularly fails with
 * CONNECT_TIMEOUT or ECONNRESET, then works. Retry rather than treating the
 * first failure as an answer.
 */
async function withRetry<T>(label: string, fn: () => Promise<T>, attempts = 5): Promise<T> {
  let lastErr: unknown
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn()
    } catch (e: any) {
      lastErr = e
      console.log(`  ${label}: attempt ${i}/${attempts} failed (${e.message}) — retrying…`)
      await new Promise((r) => setTimeout(r, i * 3000))
    }
  }
  throw lastErr
}

async function main() {
  console.log(`\n=== HOST: ${new URL(url!).hostname} ===\n`)

  // What the app expects
  const schemaSrc = readFileSync(join(process.cwd(), 'src/db/schema.ts'), 'utf8')
  const declared = new Set(
    [...schemaSrc.matchAll(/pgTable\('([a-z_]+)'/g)].map((m) => m[1]),
  )

  // What actually exists
  const rows = await withRetry('tables', () => sql<{ table_name: string }[]>`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `)
  const actual = new Set(rows.map((r) => r.table_name))

  console.log(`declared in schema.ts : ${declared.size}`)
  console.log(`present in database   : ${actual.size}\n`)

  const missing = [...declared].filter((t) => !actual.has(t)).sort()
  console.log(`🔴 DECLARED BUT MISSING FROM DB (${missing.length}) — app will 42P01 on these:`)
  console.log(missing.length ? missing.map((t) => `  ${t}`).join('\n') : '  (none)')

  const undeclared = [...actual].filter((t) => !declared.has(t)).sort()
  console.log(`\n⚪ IN DB BUT NOT DECLARED IN schema.ts (${undeclared.length}):`)
  console.log(undeclared.length ? undeclared.map((t) => `  ${t}`).join('\n') : '  (none)')

  await sql.end()
}

main().catch(async (e) => { console.error('ERROR:', e.message); process.exit(1) })
